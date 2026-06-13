export default function StatusBadge({ status }) {
  const config = {
    pending: { label: 'รออนุมัติ', className: 'badge-pending', icon: '🟡' },
    approved: { label: 'อนุมัติแล้ว', className: 'badge-approved', icon: '🟢' },
    rejected: { label: 'ปฏิเสธ', className: 'badge-rejected', icon: '🔴' },
    cancelled: { label: 'ยกเลิก', className: 'badge-cancelled', icon: '⚫' },
  };
  const s = config[status] || config.pending;
  return <span className={`badge ${s.className}`}>{s.icon} {s.label}</span>;
}
