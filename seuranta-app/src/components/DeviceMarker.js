/** RX- tai TX-laitteen merkki huonekartassa. u = piirtoyksikkö, jolla koko skaalataan kartan mittakaavaan. */
export default function DeviceMarker({ x, y, u, label, active, isRx, ...rest }) {
  const fill = isRx ? '#1d4ed8' : active ? '#059669' : '#0f2a5c';
  const stroke = active ? '#34d399' : '#3b82f6';
  return (
    <g {...rest}>
      <circle cx={x} cy={y} r={11 * u} fill={fill} stroke={stroke} strokeWidth={1.5 * u} />
      <text x={x} y={y} fill="white" fontSize={7 * u} fontWeight="700" textAnchor="middle" dominantBaseline="central">
        {label}
      </text>
    </g>
  );
}
