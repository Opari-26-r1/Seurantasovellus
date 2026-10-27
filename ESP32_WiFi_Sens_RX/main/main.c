#include <stdio.h>
#include <string.h>
#include <math.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "esp_log.h"
#include "esp_wifi.h"
#include "esp_now.h"
#include "nvs_flash.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "bmp280.h"
#include "http_client_service.h"

#define WIFI_SSID           "SSID"
#define WIFI_PASS           "PASSWORD"
#define SENSING_CHANNEL     6
#define WINDOW_SIZE         30
#define NUM_SUBCARRIERS     64
#define VARIANCE_THRESHOLD  3.5f
#define NUM_TX_NODES 4  // kuinka monta nodea verkossa on
                        // muista myös lisätä oikea määrä MAC osoitteita

static const char *TAG = "CSI_RX";
static const uint8_t s_TX_mac[NUM_TX_NODES][ESP_NOW_ETH_ALEN] = {
                             {0x00, 0x00, 0x00, 0x00, 0x00, 0x00}, //node 1 esp32-s3
                            {0x00, 0x00, 0x00, 0x00, 0x00, 0x00}, //node 2 esp32 D0WD
                            {0x00, 0x00, 0x00, 0x00, 0x00, 0x00}, //node 3 esp32 D0WD
                            {0x00, 0x00, 0x00, 0x00, 0x00, 0x00}   //node 4 esp32 D0WD
};

//ESP-NOW device pairing unique keys
static const char *PMK_KEY_STR = "tamaonpmkavainjo";
static const char *LMK_KEY_STR = "tamaonlmkavainjo";

static float s_amp_window[NUM_TX_NODES][WINDOW_SIZE][NUM_SUBCARRIERS];
static int s_win_idx[NUM_TX_NODES]       = {0, 0, 0, 0};
static bool s_buffer_ready[NUM_TX_NODES] = {false, false, false, false};
static float s_variances[NUM_TX_NODES]   = {0.0f, 0.0f, 0.0f, 0.0f};

typedef struct {
    float variance[NUM_TX_NODES];
    bool presence[NUM_TX_NODES];
} telemetry_event_t;

static QueueHandle_t s_telemetry_queue = NULL;
static bool s_wifi_connected = false;

// Event loop handler for Wi-Fi and IP
static void wifi_event_handler(void* arg, esp_event_base_t event_base,
                               int32_t event_id, void* event_data) {
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        s_wifi_connected = false;
        ESP_LOGW(TAG, "Wi-Fi disconnected. Reconnecting...");
        esp_wifi_connect();
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        s_wifi_connected = true;
        ESP_LOGI(TAG, "Connected to AP with valid IP!");
    }
}

// Dedicated FreeRTOS background task: performs HTTP network operations
static void telemetry_task(void *pvParameters) {
    telemetry_event_t event;
    while (1) {
        if (xQueueReceive(s_telemetry_queue, &event, portMAX_DELAY) == pdTRUE) {
            if (s_wifi_connected) {
                float temp = NAN;
                float press = NAN;
                if (bmp280_read(&temp, &press)) {
                    ESP_LOGI(TAG, "BMP280: Lämpötila = %.2f °C, Ilmanpaine = %.2f hPa", temp, press);
                } else {
                    ESP_LOGD(TAG, "BMP280 ei saatavilla, lähetetään NAN");
                }
                http_client_send_telemetry(temp, press, event.variance, event.presence, NUM_TX_NODES);
            } else {
                ESP_LOGW(TAG, "Skipping HTTP POST: No Wi-Fi IP connection");
            }
        }
    }
}

// CSI packet callback
static void wifi_csi_rx_cb(void *ctx, wifi_csi_info_t *info) {
    if (!info || !info->buf) return;
    if (info->len < NUM_SUBCARRIERS * 2) return;

    // Tunnistetaan mistä TX:stä paketti tuli
    int tx_idx = -1;
    for (int i = 0; i < NUM_TX_NODES; i++) {
        if (memcmp(info->mac, s_TX_mac[i], ESP_NOW_ETH_ALEN) == 0) {
            tx_idx = i;
            break;
        }
    }
    if (tx_idx == -1) return; // Tuntematon laite -> ohitetaan

    int8_t *csi_raw = (int8_t *)info->buf;
    int curr_idx = s_win_idx[tx_idx];
    for (int i = 0; i < NUM_SUBCARRIERS; i++) {
        int8_t imag = csi_raw[i * 2];
        int8_t real = csi_raw[i * 2 + 1];
        s_amp_window[tx_idx][curr_idx][i] = sqrtf((float)(real * real + imag * imag));
    }

    s_win_idx[tx_idx] = (curr_idx + 1) % WINDOW_SIZE;
    if (s_win_idx[tx_idx] == 0) s_buffer_ready[tx_idx] = true;
    if (!s_buffer_ready[tx_idx]) return;

    float total_var = 0.0f;
    int valid_subcarriers = 0;

    for (int sc = 6; sc < 58; sc++) {
        if (sc >= 28 && sc <= 36) continue;

        float sum = 0.0f;
        for (int w = 0; w < WINDOW_SIZE; w++) {
            sum += s_amp_window[tx_idx][w][sc];
        }
        float mean = sum / WINDOW_SIZE;

        float var_sum = 0.0f;
        for (int w = 0; w < WINDOW_SIZE; w++) {
            float diff = s_amp_window[tx_idx][w][sc] - mean;
            var_sum += diff * diff;
        }
        total_var += (var_sum / WINDOW_SIZE);
        valid_subcarriers++;
    }

    // Tallennetaan laskettu varianssi oikealle nodelle
    s_variances[tx_idx] = total_var / valid_subcarriers;

    // Rate-limit: Lähetetään koottu tilanne 1.5 s välein
    static TickType_t last_send_tick = 0;
    static bool last_presence_state = false;
    TickType_t now = xTaskGetTickCount();
    bool current_presence = false;

    for (int i = 0; i < NUM_TX_NODES; i++) {
        if (s_variances[i] > VARIANCE_THRESHOLD) {
            current_presence = true;
            break;
        }
    }

    bool state_changed = (current_presence != last_presence_state);
    bool interval_elapsed = (now - last_send_tick) > pdMS_TO_TICKS(30000);
    bool cooldown_ok = (now - last_send_tick) > pdMS_TO_TICKS(1500);

    if (cooldown_ok && (state_changed || interval_elapsed)) {
        last_send_tick = now;
        last_presence_state = current_presence;

        telemetry_event_t event;
        for (int i = 0; i < NUM_TX_NODES; i++) {
            event.variance[i] = s_variances[i];
            event.presence[i] = (s_variances[i] > VARIANCE_THRESHOLD);
        }
        xQueueSend(s_telemetry_queue, &event, 0);
    }
}

void app_main(void) {
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    // Alustetaan BMP280-anturi
    esp_err_t bmp_ret = bmp280_init();
    if (bmp_ret == ESP_OK) {
        ESP_LOGI(TAG, "BMP280-anturi alustettu ja valmis");
    } else {
        ESP_LOGW(TAG, "BMP280-anturin alustus epäonnistui (%s). Jatketaan ilman anturia.", esp_err_to_name(bmp_ret));
    }

    // Register Wi-Fi & IP handlers
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL, NULL));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL, NULL));

    // Initialize Wi-Fi Station
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));
    ESP_ERROR_CHECK(esp_wifi_set_storage(WIFI_STORAGE_RAM));
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));

    wifi_config_t wifi_config = {
        .sta = {
            .ssid = WIFI_SSID,
            .password = WIFI_PASS,
            .channel = SENSING_CHANNEL, // Pin STA to match transmitter channel
        },
    };
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    // Wi-Fi Promiscuous & Channel Setup
    ESP_ERROR_CHECK(esp_wifi_set_promiscuous(true));
    wifi_promiscuous_filter_t filter = { .filter_mask = WIFI_PROMIS_FILTER_MASK_ALL };
    ESP_ERROR_CHECK(esp_wifi_set_promiscuous_filter(&filter));
    
    // CSI Setup
    wifi_csi_config_t csi_config = {
        .lltf_en = true,
        .htltf_en = true,
        .stbc_htltf2_en = true,
        .ltf_merge_en = true,
        .channel_filter_en = false,
        .manu_scale = false,
    };
    ESP_ERROR_CHECK(esp_wifi_set_csi_config(&csi_config));
    ESP_ERROR_CHECK(esp_wifi_set_csi_rx_cb(wifi_csi_rx_cb, NULL));
    ESP_ERROR_CHECK(esp_wifi_set_csi(true));

    // ESP-NOW Setup
    ESP_ERROR_CHECK(esp_now_init());
    ESP_ERROR_CHECK(esp_now_set_pmk((uint8_t *)PMK_KEY_STR));

    for (int i = 0; i < NUM_TX_NODES; i++){
        esp_now_peer_info_t peer = {
            .channel = SENSING_CHANNEL,
            .ifidx = WIFI_IF_STA,
            .encrypt = true,
        };
        memcpy(peer.peer_addr, s_TX_mac[i], ESP_NOW_ETH_ALEN);
        memcpy(peer.lmk, LMK_KEY_STR, ESP_NOW_KEY_LEN);
        ESP_ERROR_CHECK(esp_now_add_peer(&peer));
    };

    // Create FreeRTOS Queue and Background Worker Task
    s_telemetry_queue = xQueueCreate(10, sizeof(telemetry_event_t));
    xTaskCreatePinnedToCore(telemetry_task, "telemetry_task", 4096, NULL, 5, NULL, 1);

    ESP_LOGI(TAG, "RX running. Listening for CSI on Ch %d and connecting to Wi-Fi...", SENSING_CHANNEL);
}