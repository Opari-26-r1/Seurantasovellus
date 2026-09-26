#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "esp_now.h"
#include "nvs_flash.h"
#include "esp_netif.h"
#include "esp_event.h"

#define SENSING_CHANNEL 6
#define PING_INTERVAL_US 33333 // 30 Hz (~33.3 ms)

static const char *TAG = "CSI_TX";
static const uint8_t s_RX_mac[ESP_NOW_ETH_ALEN] = {0x80, 0xb5, 0x4e, 0xde, 0x96, 0xb8}; //Tähän RX MAC
static uint32_t s_seq = 0;

static const char* PMK_KEY_STR = "tamaonpmkavainjo";
static const char* LMK_KEY_STR = "tamaonlmkavainjo";

static void ping_timer_callback(void *arg) {
    uint8_t payload[8];
    memcpy(payload, &s_seq, sizeof(s_seq));
    s_seq++;

    esp_err_t err = esp_now_send(s_RX_mac, payload, sizeof(payload));
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Lähetysvirhe: %d", err);
    }
}

void app_main(void) {
    ESP_ERROR_CHECK(nvs_flash_init());
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));
    ESP_ERROR_CHECK(esp_wifi_set_storage(WIFI_STORAGE_RAM));
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    
    
    //Wi-Fi käynnistys jonka jälkeen pakotta vain 802.11n (HT) päälle: TÄMÄ KOHTA VOI OLLA TURHA
    ESP_ERROR_CHECK(esp_wifi_set_protocol(WIFI_IF_STA, WIFI_PROTOCOL_11B | WIFI_PROTOCOL_11G | WIFI_PROTOCOL_11N));
    // Estä vanhat 11b-nopeudet, jolloin lähetys tapahtuu OFDM/HT-nopeuksilla (CSI vaatimus)
    ESP_ERROR_CHECK(esp_wifi_config_11b_rate(WIFI_IF_STA, false));
    ESP_ERROR_CHECK(esp_wifi_start());

    //Wi-Fi kanava asetuksien määritys sekä lukitsee kanavan 6 käyttöön
    ESP_ERROR_CHECK(esp_wifi_set_promiscuous(true));
    ESP_ERROR_CHECK(esp_wifi_set_channel(SENSING_CHANNEL, WIFI_SECOND_CHAN_NONE));
    ESP_ERROR_CHECK(esp_wifi_set_promiscuous(false));


    //Alustaa ESP-NOW ja asetta PMK-avain
    ESP_ERROR_CHECK(esp_now_init());
    ESP_ERROR_CHECK(esp_now_set_pmk((const uint8_t *)PMK_KEY_STR)); // Aseta PMK

    esp_now_peer_info_t peer_info = {
        .channel    =   SENSING_CHANNEL,
        .ifidx      =   WIFI_IF_STA,
        .encrypt    =   true,
    };

    memcpy(peer_info.peer_addr, s_RX_mac, ESP_NOW_ETH_ALEN);
    memcpy(peer_info.lmk, LMK_KEY_STR, ESP_NOW_KEY_LEN);
    ESP_ERROR_CHECK(esp_now_add_peer(&peer_info));

    //Pakotetaan tälle peerille 802.11n (HT20) nopeus, jotta CSI toimii
    esp_now_rate_config_t rate_cfg = {
        .phymode = WIFI_PHY_MODE_HT20,
        .rate    = WIFI_PHY_RATE_MCS0_LGI,
        .ersu    = false,
        .dcm     = false
    };
    ESP_ERROR_CHECK(esp_now_set_peer_rate_config(peer_info.peer_addr, &rate_cfg));

    //Ajastin 30 Hz lähetykselle
    const esp_timer_create_args_t timer_args = {
        .callback = &ping_timer_callback,
        .name = "csi_ping_timer"
    };
    esp_timer_handle_t timer_handle;
    ESP_ERROR_CHECK(esp_timer_create(&timer_args, &timer_handle));
    ESP_ERROR_CHECK(esp_timer_start_periodic(timer_handle, PING_INTERVAL_US));

    ESP_LOGI(TAG, "TX started. Sending HT packets to RX on Ch %d at 30 Hz...", SENSING_CHANNEL);
}
