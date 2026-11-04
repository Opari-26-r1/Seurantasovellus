from pydantic import BaseModel, Field


class LinkIn(BaseModel):
    """Yhden TX -> RX -linjan CSI-tulos."""

    tx_id: int = Field(ge=1, le=32, examples=[1])
    variance: float | None = Field(default=None, ge=0, examples=[4.2])
    presence: bool = Field(examples=[True])


class ReadingIn(BaseModel):
    """ESP32:n (RX-hubin) lähettämä mittaus. Rajat hylkäävät selvästi virheelliset arvot."""

    device_id: str = Field(min_length=1, max_length=64, examples=["RX_S3_HUB"])
    temperature: float | None = Field(default=None, ge=-40, le=85, examples=[22.4])
    humidity: float | None = Field(default=None, ge=0, le=100, examples=[46])
    pressure: float | None = Field(default=None, ge=300, le=1100, examples=[1012.3])
    # Jos motion puuttuu mutta links on mukana, liike päätellään linjoista
    motion: bool | None = Field(default=None, examples=[None])
    rssi: int | None = Field(default=None, ge=-120, le=0, examples=[-56])
    uptime_s: int | None = Field(default=None, ge=0, examples=[534720])
    links: list[LinkIn] | None = Field(
        default=None,
        max_length=32,
        examples=[[
            {"tx_id": 1, "variance": 1.8, "presence": False},
            {"tx_id": 2, "variance": 4.6, "presence": True},
            {"tx_id": 3, "variance": 2.1, "presence": False},
            {"tx_id": 4, "variance": 1.5, "presence": False},
        ]],
    )

    def room_motion(self) -> bool | None:
        """Huoneen liiketila: ESP:n oma motion, tai liikettä jos yksikin linja havaitsee."""
        if self.motion is not None:
            return self.motion
        if self.links:
            return any(link.presence for link in self.links)
        return None
