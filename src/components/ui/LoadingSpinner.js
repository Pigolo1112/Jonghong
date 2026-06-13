export default function LoadingSpinner({ size = 'md', message = 'กำลังโหลดข้อมูล...' }) {
  return (
    <div className="page-loader">
      <div className={`spinner ${size === 'lg' ? 'lg' : ''}`}></div>
      {message && <p>{message}</p>}
    </div>
  );
}
