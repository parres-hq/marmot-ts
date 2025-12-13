import { useRef } from "react";
import QRImage from "./qr-image";

interface QRModalProps {
  data: string;
  modalId: string;
  modalSize?: number;
}

export default function QRModal({
  data,
  modalId,
  modalSize = 500,
}: QRModalProps) {
  const modalRef = useRef<HTMLDialogElement>(null);

  const handleClose = () => {
    modalRef.current?.close();
  };

  return (
    <dialog id={modalId} className="modal" ref={modalRef}>
      <div className="modal-box max-w-2xl">
        <form method="dialog">
          <button
            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
            onClick={handleClose}
            type="button"
          >
            ✕
          </button>
        </form>

        <h3 className="font-bold text-lg mb-4">QR Code</h3>

        <QRImage data={data} size={modalSize} className="mx-auto" />

        <div className="mt-4">
          <div className="text-xs text-base-content/60 mb-1">Data:</div>
          <code className="text-xs break-all block p-2 bg-base-200 rounded">
            {data}
          </code>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={handleClose}>close</button>
      </form>
    </dialog>
  );
}
