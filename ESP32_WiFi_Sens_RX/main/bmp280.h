#pragma once

#include <stdbool.h>
#include "esp_err.h"
#include "driver/gpio.h"

#ifdef __cplusplus
extern "C" {
#endif

// BMP280 & I2C oletusmääritykset
#ifndef I2C_MASTER_SCL_IO
#define I2C_MASTER_SCL_IO           GPIO_NUM_9  // SCL GPIO (muokkaa kytkentäsi mukaan, esim. 9 tai 5)
#endif

#ifndef I2C_MASTER_SDA_IO
#define I2C_MASTER_SDA_IO           GPIO_NUM_8  // SDA GPIO (muokkaa kytkentäsi mukaan, esim. 8 tai 4)
#endif

#ifndef I2C_MASTER_FREQ_HZ
#define I2C_MASTER_FREQ_HZ          100000      // 100 kHz standard mode
#endif

#define BMP280_I2C_ADDR_PRIM        0x76        // Ensisijainen I2C-osoite (SDO = GND)
#define BMP280_I2C_ADDR_SEC         0x77        // Toissijainen I2C-osoite (SDO = VDDIO)

/**
 * @brief Alustaa I2C-väylän ja BMP280-anturin.
 *        Tunnistaa automaattisesti osoitteen 0x76 tai 0x77,
 *        lataa kalibrointiarvot ja asettaa normaalin jatkuvan mittaustilan.
 * 
 * @return esp_err_t ESP_OK jos onnistui, virhekoodi muuten.
 */
esp_err_t bmp280_init(void);

/**
 * @brief Lukee kompensoidun lämpötilan ja ilmanpaineen anturilta.
 * 
 * @param[out] temperature Osoitin johon tallennetaan lämpötila (°C) tai NAN
 * @param[out] pressure Osoitin johon tallennetaan ilmanpaine (hPa) tai NAN
 * @return true jos mittaus onnistui, false jos anturi ei vastaa tai mittaus epäonnistui.
 */
bool bmp280_read(float *temperature, float *pressure);

#ifdef __cplusplus
}
#endif

