#include "bmp280.h"
#include <math.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "driver/i2c_master.h"

static const char *TAG = "BMP280";

// BMP280 rekisteriosoitteet
#define BMP280_REG_CHIP_ID          0xD0
#define BMP280_REG_RESET            0xE0
#define BMP280_REG_STATUS           0xF3
#define BMP280_REG_CTRL_MEAS        0xF4
#define BMP280_REG_CONFIG           0xF5
#define BMP280_REG_PRESS_MSB        0xF7
#define BMP280_REG_CALIB00          0x88

// BMP280 kalibrointiparametrit
typedef struct {
    uint16_t dig_T1;
    int16_t  dig_T2;
    int16_t  dig_T3;
    uint16_t dig_P1;
    int16_t  dig_P2;
    int16_t  dig_P3;
    int16_t  dig_P4;
    int16_t  dig_P5;
    int16_t  dig_P6;
    int16_t  dig_P7;
    int16_t  dig_P8;
    int16_t  dig_P9;
} bmp280_calib_data_t;

static i2c_master_bus_handle_t s_i2c_bus = NULL;
static i2c_master_dev_handle_t s_bmp280_dev = NULL;
static bmp280_calib_data_t s_bmp280_calib;
static bool s_bmp280_ready = false;

static esp_err_t bmp280_read_bytes(uint8_t reg_addr, uint8_t *data, size_t len) {
    if (!s_bmp280_dev) return ESP_ERR_INVALID_STATE;
    return i2c_master_transmit_receive(s_bmp280_dev, &reg_addr, 1, data, len, 1000);
}

static esp_err_t bmp280_write_byte(uint8_t reg_addr, uint8_t value) {
    if (!s_bmp280_dev) return ESP_ERR_INVALID_STATE;
    uint8_t buf[2] = {reg_addr, value};
    return i2c_master_transmit(s_bmp280_dev, buf, sizeof(buf), 1000);
}

esp_err_t bmp280_init(void) {
    if (s_bmp280_ready) {
        return ESP_OK;
    }

    if (s_i2c_bus == NULL) {
        i2c_master_bus_config_t bus_config = {
            .i2c_port = I2C_NUM_0,
            .sda_io_num = I2C_MASTER_SDA_IO,
            .scl_io_num = I2C_MASTER_SCL_IO,
            .clk_source = I2C_CLK_SRC_DEFAULT,
            .glitch_ignore_cnt = 7,
            .flags.enable_internal_pullup = true,
        };
        esp_err_t err = i2c_new_master_bus(&bus_config, &s_i2c_bus);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "I2C-masterväylän luonti epäonnistui: %s", esp_err_to_name(err));
            return err;
        }
    }

    // Etsitään kumpaa osoitetta (0x76 vai 0x77) BMP280 käyttää
    uint8_t dev_addr = 0;
    if (i2c_master_probe(s_i2c_bus, BMP280_I2C_ADDR_PRIM, 50) == ESP_OK) {
        dev_addr = BMP280_I2C_ADDR_PRIM;
    } else if (i2c_master_probe(s_i2c_bus, BMP280_I2C_ADDR_SEC, 50) == ESP_OK) {
        dev_addr = BMP280_I2C_ADDR_SEC;
    } else {
        ESP_LOGW(TAG, "BMP280-anturia ei löytynyt I2C-väylästä (tarkistettu 0x76 ja 0x77)");
        return ESP_ERR_NOT_FOUND;
    }

    if (s_bmp280_dev == NULL) {
        i2c_device_config_t dev_config = {
            .dev_addr_length = I2C_ADDR_BIT_LEN_7,
            .device_address = dev_addr,
            .scl_speed_hz = I2C_MASTER_FREQ_HZ,
        };
        esp_err_t err = i2c_master_bus_add_device(s_i2c_bus, &dev_config, &s_bmp280_dev);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "BMP280-laitteen lisäys I2C-väylään epäonnistui: %s", esp_err_to_name(err));
            return err;
        }
    }

    // Luetaan ja tarkistetaan Chip ID (0x58 BMP280:lle, 0x60 BME280:lle)
    uint8_t chip_id = 0;
    esp_err_t err = bmp280_read_bytes(BMP280_REG_CHIP_ID, &chip_id, 1);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "BMP280 Chip ID lukeminen epäonnistui: %s", esp_err_to_name(err));
        return err;
    }
    ESP_LOGI(TAG, "BMP280 havaittu osoitteessa 0x%02X, Chip ID: 0x%02X", dev_addr, chip_id);

    // Pehmeä nollaus (soft reset)
    bmp280_write_byte(BMP280_REG_RESET, 0xB6);
    vTaskDelay(pdMS_TO_TICKS(20));

    // Odotetaan, että NVM-kopiointi valmistuu (status-rekisterin bitti 0)
    uint8_t status = 0;
    int retry = 20;
    while (retry-- > 0) {
        if (bmp280_read_bytes(BMP280_REG_STATUS, &status, 1) == ESP_OK) {
            if ((status & 0x01) == 0) break;
        }
        vTaskDelay(pdMS_TO_TICKS(5));
    }

    // Luetaan 24 tavua kalibrointidataa (0x88 - 0x9F)
    uint8_t calib[24];
    err = bmp280_read_bytes(BMP280_REG_CALIB00, calib, 24);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "BMP280 kalibrointidatan luku epäonnistui: %s", esp_err_to_name(err));
        return err;
    }

    s_bmp280_calib.dig_T1 = (uint16_t)(calib[0]  | ((uint16_t)calib[1]  << 8));
    s_bmp280_calib.dig_T2 = (int16_t) (calib[2]  | ((uint16_t)calib[3]  << 8));
    s_bmp280_calib.dig_T3 = (int16_t) (calib[4]  | ((uint16_t)calib[5]  << 8));
    s_bmp280_calib.dig_P1 = (uint16_t)(calib[6]  | ((uint16_t)calib[7]  << 8));
    s_bmp280_calib.dig_P2 = (int16_t) (calib[8]  | ((uint16_t)calib[9]  << 8));
    s_bmp280_calib.dig_P3 = (int16_t) (calib[10] | ((uint16_t)calib[11] << 8));
    s_bmp280_calib.dig_P4 = (int16_t) (calib[12] | ((uint16_t)calib[13] << 8));
    s_bmp280_calib.dig_P5 = (int16_t) (calib[14] | ((uint16_t)calib[15] << 8));
    s_bmp280_calib.dig_P6 = (int16_t) (calib[16] | ((uint16_t)calib[17] << 8));
    s_bmp280_calib.dig_P7 = (int16_t) (calib[18] | ((uint16_t)calib[19] << 8));
    s_bmp280_calib.dig_P8 = (int16_t) (calib[20] | ((uint16_t)calib[21] << 8));
    s_bmp280_calib.dig_P9 = (int16_t) (calib[22] | ((uint16_t)calib[23] << 8));

    // Asetukset:
    // CONFIG (0xF5): standby 500ms (0b100 << 5), IIR-suodatin 16 (0b100 << 2) -> 0x90
    bmp280_write_byte(BMP280_REG_CONFIG, (0x04 << 5) | (0x04 << 2));

    // CTRL_MEAS (0xF4):
    // Lämpötilan ylinäytteistys x2 (0b010 << 5), Paine x16 (0b101 << 2), Normaali jatkuva tila (0b11) -> 0x57
    bmp280_write_byte(BMP280_REG_CTRL_MEAS, (0x02 << 5) | (0x05 << 2) | 0x03);

    s_bmp280_ready = true;
    ESP_LOGI(TAG, "BMP280 alustettu onnistuneesti (Normal-tila, IIR 16, t_sb 500ms)");
    return ESP_OK;
}

bool bmp280_read(float *temperature, float *pressure) {
    if (!s_bmp280_ready) {
        if (bmp280_init() != ESP_OK) {
            if (temperature) *temperature = NAN;
            if (pressure) *pressure = NAN;
            return false;
        }
    }

    uint8_t data[6];
    esp_err_t err = bmp280_read_bytes(BMP280_REG_PRESS_MSB, data, 6);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "BMP280 luku epäonnistui: %s", esp_err_to_name(err));
        if (temperature) *temperature = NAN;
        if (pressure) *pressure = NAN;
        return false;
    }

    int32_t adc_P = ((int32_t)data[0] << 12) | ((int32_t)data[1] << 4) | ((int32_t)data[2] >> 4);
    int32_t adc_T = ((int32_t)data[3] << 12) | ((int32_t)data[4] << 4) | ((int32_t)data[5] >> 4);

    if (adc_T == 0x80000 || adc_P == 0x80000) {
        if (temperature) *temperature = NAN;
        if (pressure) *pressure = NAN;
        return false;
    }

    // Lämpötilan kompensointi (Bosch Sensortec -kaava)
    double var1 = (((double)adc_T) / 16384.0 - ((double)s_bmp280_calib.dig_T1) / 1024.0) * ((double)s_bmp280_calib.dig_T2);
    double var2 = ((((double)adc_T) / 131072.0 - ((double)s_bmp280_calib.dig_T1) / 8192.0) *
                   (((double)adc_T) / 131072.0 - ((double)s_bmp280_calib.dig_T1) / 8192.0)) * ((double)s_bmp280_calib.dig_T3);
    double t_fine = var1 + var2;
    double comp_temp = (var1 + var2) / 5120.0; // °C

    // Ilmanpaineen kompensointi (Bosch Sensortec -kaava)
    double p_var1 = (t_fine / 2.0) - 64000.0;
    double p_var2 = p_var1 * p_var1 * ((double)s_bmp280_calib.dig_P6) / 32768.0;
    p_var2 = p_var2 + p_var1 * ((double)s_bmp280_calib.dig_P5) * 2.0;
    p_var2 = (p_var2 / 4.0) + (((double)s_bmp280_calib.dig_P4) * 65536.0);
    p_var1 = (((double)s_bmp280_calib.dig_P3) * p_var1 * p_var1 / 524288.0 + ((double)s_bmp280_calib.dig_P2) * p_var1) / 524288.0;
    p_var1 = (1.0 + p_var1 / 32768.0) * ((double)s_bmp280_calib.dig_P1);

    double comp_press = 0.0;
    if (p_var1 != 0.0) {
        double p = 1048576.0 - (double)adc_P;
        p = (p - (p_var2 / 4096.0)) * 6250.0 / p_var1;
        p_var1 = ((double)s_bmp280_calib.dig_P9) * p * p / 2147483648.0;
        p_var2 = p * ((double)s_bmp280_calib.dig_P8) / 32768.0;
        p = p + (p_var1 + p_var2 + ((double)s_bmp280_calib.dig_P7)) / 16.0;
        comp_press = p / 100.0; // Pa -> hPa
    }

    if (temperature) *temperature = (float)comp_temp;
    if (pressure) *pressure = (float)comp_press;
    return true;
}

