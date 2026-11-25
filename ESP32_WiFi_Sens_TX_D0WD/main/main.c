#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_wifi.h"
#include "esp_now.h"
#include "nvs_flash.h"
#include "esp_netif.h"
#include "esp_event.h"

#define SENSING_CHANNEL 6

// MÄÄRITÄ TÄMÄ KULLEKIN LAUDALLE: 1, 2, 3 tai 4
#define TX_NODE_ID      4   //muuta nodenumeroa +1 aina kun ajat uudelle laudalle
                            //node 1 = ESP32-S3, nodet 2, 3 & 4 = ESP32-D0WD

static const char *TAG = "CSI_TX";
static const uint8_t s_RX_mac[ESP_NOW_ETH_ALEN] = {0x00, 0x00, 0x00, 0x00, 0x00, 0x00}; // RX S3:n MAC

static const char *PMK_KEY_STR = "tamaonpmkavainjo";
static const char *LMK_KEY_STR = "tamaonlmkavainjo";

// Lähetyspayload
typedef struct {
    uint8_t node_id;
    uint32_t seq_num;
} tx_payload_t;

static void tx_beacon_task(void *pvParameters) {
    // Porrastaa aloitukset
    vTaskDelay(pdMS_TO_TICKS((TX_NODE_ID - 1) * 11));

    // Lähetyspayload
    tx_payload_t payload = {
        .node_id = TX_NODE_ID,
        .seq_num = 0
    };

    TickType_t xLastWakeTime = xTaskGetTickCount();
    const TickType_t xFrequency = pdMS_TO_TICKS(33); // ~30.3 Hz

    while (1) {
        payload.seq_num++;
        esp_err_t err = esp_now_send(s_RX_mac, (uint8_t *)&payload, sizeof(payload));
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Lähetysvirhe: %d", err);
        }

        // Tarkka herätys 33 ms välein ilman ryömintää
        vTaskDelayUntil(&xLastWakeTime, xFrequency);
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

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));
    ESP_ERROR_CHECK(esp_wifi_set_storage(WIFI_STORAGE_RAM));
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));

    // Asetetaan 802.11b/g/n protokollat ja estetään 11b-nopeudet (OFDM/HT CSI:tä varten)
    ESP_ERROR_CHECK(esp_wifi_set_protocol(WIFI_IF_STA, WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N));
    ESP_ERROR_CHECK(esp_wifi_config_11b_rate(WIFI_IF_STA, true));
    ESP_ERROR_CHECK(esp_wifi_start());

    // Kiinnitetään taajuus kanavalle 6 (vaatii promiscuous-tilan käytön kanavan vaihtoon STA-tilassa)
    ESP_ERROR_CHECK(esp_wifi_set_promiscuous(true));
    ESP_ERROR_CHECK(esp_wifi_set_channel(SENSING_CHANNEL, WIFI_SECOND_CHAN_NONE));
    ESP_ERROR_CHECK(esp_wifi_set_promiscuous(false));

    // ESP-NOW alustus ja PMK-avain
    ESP_ERROR_CHECK(esp_now_init());
    ESP_ERROR_CHECK(esp_now_set_pmk((const uint8_t *)PMK_KEY_STR));

    esp_now_peer_info_t peer = {
        .channel = SENSING_CHANNEL,
        .ifidx = WIFI_IF_STA,
        .encrypt = true,
    };
    memcpy(peer.peer_addr, s_RX_mac, ESP_NOW_ETH_ALEN);
    memcpy(peer.lmk, LMK_KEY_STR, ESP_NOW_KEY_LEN);
    ESP_ERROR_CHECK(esp_now_add_peer(&peer));

    // Pakotetaan tälle peerille 802.11n (HT20) nopeus CSI-laskentaa varten
    esp_now_rate_config_t rate_cfg = {
        .phymode = WIFI_PHY_MODE_HT20,
        .rate    = WIFI_PHY_RATE_MCS0_LGI,
        .ersu    = false,
        .dcm     = false
    };
    ESP_ERROR_CHECK(esp_now_set_peer_rate_config(peer.peer_addr, &rate_cfg));

    // Käynnistetään lähetystehtävä
    xTaskCreate(tx_beacon_task, "tx_task", 2048, NULL, 5, NULL);
    ESP_LOGI(TAG, "TX Node %d käynnistetty Ch %d ", TX_NODE_ID, SENSING_CHANNEL);
}