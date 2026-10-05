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

// MÄÄRITÄ TÄMÄ KULLEKIN LAUDALLE: 1, 2 tai 3
#define TX_NODE_ID      2   //muuta nodenumeroa +1 aina kun ajat uudelle laudalle
                            //node numerot 2, 3 & 4 ESP32-D0WD laudoille

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
    // Porrastetaan aloitukset: TX1 = 0ms, TX2 = 11ms, TX3 = 22ms
    vTaskDelay(pdMS_TO_TICKS((TX_NODE_ID - 1) * 11));

    tx_payload_t payload = {
        .node_id = TX_NODE_ID,
        .seq_num = 0
    };

    TickType_t xLastWakeTime = xTaskGetTickCount();
    const TickType_t xFrequency = pdMS_TO_TICKS(33); // ~30.3 Hz

    while (1) {
        payload.seq_num++;
        esp_now_send(s_RX_mac, (uint8_t *)&payload, sizeof(payload));

        // Tarkka herätys 33 ms välein ilman ryömintää
        vTaskDelayUntil(&xLastWakeTime, xFrequency);
    }
}

void app_main(void) {
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        nvs_flash_erase();
        nvs_flash_init();
    }

    esp_netif_init();
    esp_event_loop_create_default();
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    esp_wifi_init(&cfg);
    esp_wifi_set_storage(WIFI_STORAGE_RAM);
    esp_wifi_set_mode(WIFI_MODE_STA);
    esp_wifi_start();

    // Kiinnitetään taajuus kanavalle 6
    esp_wifi_set_channel(SENSING_CHANNEL, WIFI_SECOND_CHAN_NONE);

    // ESP-NOW alustus
    esp_now_init();
    esp_now_set_pmk((uint8_t *)PMK_KEY_STR);

    esp_now_peer_info_t peer = {
        .channel = SENSING_CHANNEL,
        .ifidx = WIFI_IF_STA,
        .encrypt = true,
    };
    memcpy(peer.peer_addr, s_RX_mac, ESP_NOW_ETH_ALEN);
    memcpy(peer.lmk, LMK_KEY_STR, ESP_NOW_KEY_LEN);
    esp_now_add_peer(&peer);

    // Käynnistetään lähetystehtävä
    xTaskCreate(tx_beacon_task, "tx_task", 2048, NULL, 5, NULL);
    ESP_LOGI(TAG, "TX Node %d käynnistetty Ch %d", TX_NODE_ID, SENSING_CHANNEL);
}