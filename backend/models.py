from pydantic import BaseModel, Field


class ReadingIn(BaseModel):
    """ESP32:n lähettämä mittaus. Rajat hylkäävät selvästi virheelliset arvot."""

    device_id: str = Field(min_length=1, max_length=64, examples=["esp32-1"])
    temperature: float | None = Field(default=None, ge=-40, le=85, examples=[22.4])
    humidity: float | None = Field(default=None, ge=0, le=100, examples=[46])
    pressure: float | None = Field(default=None, ge=300, le=1100, examples=[1012.3])
    motion: bool | None = Field(default=None, examples=[False])
    rssi: int | None = Field(default=None, ge=-120, le=0, examples=[-56])
    uptime_s: int | None = Field(default=None, ge=0, examples=[534720])
