import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const QRScanner = ({ onScanSuccess, onScanFailure }) => {
    const scannerRef = useRef(null);

    useEffect(() => {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        // Automatically start the camera, which will prompt for permission natively
        html5QrCode.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 250, height: 250 }
            },
            (decodedText) => {
                if (html5QrCode.isScanning) {
                    html5QrCode.stop().then(() => {
                        if (onScanSuccess) onScanSuccess(decodedText);
                    }).catch(err => console.error("Failed to stop scanner", err));
                }
            },
            (error) => {
                if (onScanFailure) onScanFailure(error);
            }
        ).catch((err) => {
            console.error("Error starting camera automatically", err);
            if (onScanFailure) onScanFailure(err);
        });

        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().catch(error => {
                    console.error("Failed to stop html5QrCode. ", error);
                });
            }
        };
    }, []);

    return (
        <div id="reader" className="w-full min-h-[300px] bg-black rounded-lg overflow-hidden flex items-center justify-center">
            {/* The video element will be injected here by Html5Qrcode */}
        </div>
    );
};

export default QRScanner;
