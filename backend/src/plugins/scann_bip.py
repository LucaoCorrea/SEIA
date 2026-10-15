# backend/src/plugins/scann_bip.py
import cv2
import numpy as np

class ScanBip:
    def __init__(self):
        self.detector = cv2.barcode.BarcodeDetector()

    def escanear_bytes_imagem(self, bytes_imagem: bytes) -> str | None:
        """Recebe os bytes de uma imagem enviada pela API e decodifica o código de barras"""
        np_arr = np.frombuffer(bytes_imagem, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if frame is None:
            return None

        retval, decoded_info, decoded_type, _ = self.detector.detectAndDecode(frame)

        if retval:
            for info in decoded_info:
                if info:
                    return info 
                    
        return None
