#include <stdio.h>
#include <string.h>
#include <math.h>
#include "esp_log.h"
#include "esp_wifi.h"
#include "esp_now.h"
#include "nvs_flash.h"
#include "esp_event.h"
#include "esp_netif.h"

#define SENSING_CHANNEL 6
#define WINDOW_SIZE     30
#define NUM_SUBCARRIERS 64
#define VARIANCE_THRESHOLD 3.5f // Calibrate per room geometry

static const char *TAG = "CSI_RX";
static const uint8_t s_TX_mac[ESP_NOW_ETH_ALEN] = {0x20, 0x6e, 0xf1, 0x99, 0x9d, 0x2c}; // TX LAITTEEN MAC

static const char *PMK_KEY_STR = "tamaonpmkavainjo"; //pitää olla 16bit avain
static const char *LMK_KEY_STR = "tamaonlmkavainjo";

static float s_amp_window[WINDOW_SIZE][NUM_SUBCARRIERS];
static int s_win_idx = 0;
static bool s_buffer_ready = false;


// CSI packet callback
static void wifi_csi_rx_cb(void *ctx, wifi_csi_info_t *info) {

    // 1. Turvatarkistus: Varmista osoittimet ja pituus
    if (!info || !info->buf){
        return;
    }

    // DIAGNOSTIIKKA: Tulosta jokaisen havaitun paketin MAC, pituus ja RSSI
    //ESP_LOGI(TAG, "CSI saapui: MAC=%02x:%02x:%02x:%02x:%02x:%02x, RSSI=%d, len=%d",
    //         info->mac[0], info->mac[1], info->mac[2],
    //         info->mac[3], info->mac[4], info->mac[5],
    //         info->rx_ctrl.rssi, info->len);

    // 2. Suodata vain haluttu TX-lähetin
    if (memcmp(info->mac, s_TX_mac, ESP_NOW_ETH_ALEN) != 0) {
        return;
    }

    if (info->len < NUM_SUBCARRIERS * 2) {
        ESP_LOGW(TAG, "Paketin pituus liian lyhyt: %d", info->len);
        return;
    }

    int8_t *csi_raw = (int8_t *)info->buf;

    // 3. Pura alikantoaaltojen amplitudit (Imag, Real)
    for (int i = 0; i < NUM_SUBCARRIERS; i++) {
        int8_t imag = csi_raw[i * 2];
        int8_t real = csi_raw[i * 2 + 1];
        s_amp_window[s_win_idx][i] = sqrtf((float)(real * real + imag * imag));
    }

    s_win_idx = (s_win_idx + 1) % WINDOW_SIZE;
    if (s_win_idx == 0) s_buffer_ready = true;

    //if (!s_buffer_ready) return;
    // Tulosta edistyminen ennen kuin ikkuna on täynnä
    if (!s_buffer_ready) {
        ESP_LOGI(TAG, "Kerätään puskuria... %d/%d", s_win_idx, WINDOW_SIZE);
        return;
    }

    // 4. Laske varianssi aktiivisille alikantoaalloille (ohita DC ja reuna-alueet)
    float total_var = 0.0f;
    int valid_subcarriers = 0;

    for (int sc = 6; sc < 58; sc++) {
        if (sc >= 28 && sc <= 36) continue; // DC center

        float sum = 0.0f;
        for (int w = 0; w < WINDOW_SIZE; w++) {
            sum += s_amp_window[w][sc];
        }
        float mean = sum / WINDOW_SIZE;

        float var_sum = 0.0f;
        for (int w = 0; w < WINDOW_SIZE; w++) {
            float diff = s_amp_window[w][sc] - mean;
            var_sum += diff * diff;
        }
        total_var += (var_sum / WINDOW_SIZE);
        valid_subcarriers++;
    }

    float avg_var = total_var / valid_subcarriers;

    // 5. Tunnistus laskenta
    if (avg_var > VARIANCE_THRESHOLD) {
        ESP_LOGW(TAG, ">> PRESENCE DETECTED! Var: %.2f", avg_var);
    } else {
        ESP_LOGI(TAG, "   Room Empty. Var: %.2f", avg_var);
    }
}



void app_main(void) {
    //NVS ja rajapinnat
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    // 2. Wi-Fi käynnistys
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));
    ESP_ERROR_CHECK(esp_wifi_set_storage(WIFI_STORAGE_RAM));
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_start());

    //Wi-Fi kanava asetuksien määritys
    ESP_ERROR_CHECK(esp_wifi_set_promiscuous(true));
    wifi_promiscuous_filter_t filter = { .filter_mask = WIFI_PROMIS_FILTER_MASK_ALL };
    ESP_ERROR_CHECK(esp_wifi_set_promiscuous_filter(&filter));
    ESP_ERROR_CHECK(esp_wifi_set_channel(SENSING_CHANNEL, WIFI_SECOND_CHAN_NONE));

    //CSI konfigurointi
    wifi_csi_config_t csi_config;
    memset(&csi_config, 0, sizeof(wifi_csi_config_t));
    csi_config.lltf_en           = true;
    csi_config.htltf_en          = true;
    csi_config.stbc_htltf2_en    = true;
    csi_config.ltf_merge_en      = true;
    csi_config.channel_filter_en = false;
    csi_config.manu_scale        = false;

    ESP_ERROR_CHECK(esp_wifi_set_csi_config(&csi_config));
    ESP_ERROR_CHECK(esp_wifi_set_csi_rx_cb(wifi_csi_rx_cb, NULL));
    ESP_ERROR_CHECK(esp_wifi_set_csi(true));

    //ESP_NOW initialisointi
    ESP_ERROR_CHECK(esp_now_init());
    ESP_ERROR_CHECK(esp_now_set_pmk((uint8_t *)PMK_KEY_STR));

    esp_now_peer_info_t peer = {
        .channel = SENSING_CHANNEL,
        .ifidx = WIFI_IF_STA,
        .encrypt = true,
    };
    memcpy(peer.peer_addr, s_TX_mac, ESP_NOW_ETH_ALEN);
    memcpy(peer.lmk, LMK_KEY_STR, ESP_NOW_KEY_LEN);
    ESP_ERROR_CHECK(esp_now_add_peer(&peer));

    ESP_LOGI(TAG, "RX running. Listening for CSI on Ch %d...", SENSING_CHANNEL);
}
