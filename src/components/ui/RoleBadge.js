export default function RoleBadge({ role }) {
  const config = {
    admin: { label: 'ผู้ดูแลระบบ', className: 'badge-admin' },
    staff: { label: 'อาจารย์/บุคลากร', className: 'badge-staff' },
    student: { label: 'นิสิต', className: 'badge-student' },
  };
  const r = config[role] || config.student;
  return <span className={`badge ${r.className}`}>{r.label}</span>;
}
