import QRModal from "./qr-modal";

interface QRButtonProps {
  data: string;
  label?: string;
  className?: string;
  modalSize?: number;
}

export default function QRButton({
  data,
  label = "QR",
  className = "",
  modalSize = 500,
}: QRButtonProps) {
  // Generate a unique modal ID based on the data
  const modalId = `qr-modal-${data.slice(0, 16).replace(/[^a-zA-Z0-9]/g, "")}`;

  const handleClick = () => {
    const modal = document.getElementById(modalId) as HTMLDialogElement;
    modal?.showModal();
  };

  return (
    <>
      <button
        className={`btn ${className}`}
        onClick={handleClick}
        type="button"
      >
        {label}
      </button>
      <QRModal data={data} modalId={modalId} modalSize={modalSize} />
    </>
  );
}
