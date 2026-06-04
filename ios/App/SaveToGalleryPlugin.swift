import Capacitor
import Photos
import UIKit

/// 将图片直接保存到 iOS 系统图库（Photo Library），替代 Share Sheet 绕路方案。
/// 自动处理权限请求、拒绝回退。
@objc(SaveToGalleryPlugin)
public class SaveToGalleryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SaveToGalleryPlugin"
    public let jsName = "SaveToGallery"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveImage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
    ]

    // MARK: - checkPermission

    @objc func checkPermission(_ call: CAPPluginCall) {
        let status = authorizationStatus()
        call.resolve(["status": status.jsValue])
    }

    // MARK: - requestPermission

    @objc func requestPermission(_ call: CAPPluginCall) {
        let current = PHPhotoLibrary.authorizationStatus(for: .addOnly)
        switch current {
        case .authorized, .limited:
            call.resolve(["status": "authorized"])
        case .denied, .restricted:
            // iOS 不会再次弹窗，直接返回当前状态
            call.resolve(["status": current.jsValue])
        case .notDetermined:
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { [weak self] newStatus in
                DispatchQueue.main.async {
                    call.resolve(["status": self?.authorizationStatus().jsValue ?? "unknown"])
                }
            }
        @unknown default:
            call.resolve(["status": "unknown"])
        }
    }

    // MARK: - saveImage

    @objc func saveImage(_ call: CAPPluginCall) {
        guard let dataBase64 = call.getString("dataBase64") else {
            call.reject("MISSING_PARAM", "缺少参数: dataBase64")
            return
        }

        let filename = call.getString("filename") ?? "poster"

        // 移除可能的 data: URL 前缀，取出纯 base64
        var cleanBase64 = dataBase64.trimmingCharacters(in: .whitespacesAndNewlines)
        if let commaIndex = cleanBase64.firstIndex(of: ",") {
            cleanBase64 = String(cleanBase64[cleanBase64.index(after: commaIndex)...])
        }

        guard let imageData = Data(base64Encoded: cleanBase64) else {
            call.reject("DECODE_FAILED", "无法解码 base64 图片数据")
            return
        }

        let currentStatus = PHPhotoLibrary.authorizationStatus(for: .addOnly)

        switch currentStatus {
        case .authorized, .limited:
            performSave(imageData: imageData, filename: filename, call: call)
        case .notDetermined:
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { [weak self] newStatus in
                DispatchQueue.main.async {
                    if newStatus == .authorized || newStatus == .limited {
                        self?.performSave(imageData: imageData, filename: filename, call: call)
                    } else {
                        call.reject("PERMISSION_DENIED", "照片库访问权限被拒绝，请在「设置」中开启")
                    }
                }
            }
        case .denied:
            call.reject("PERMISSION_DENIED", "照片库访问权限已被拒绝，请在「设置」中开启")
        case .restricted:
            call.reject("PERMISSION_RESTRICTED", "照片库访问受限（家长控制或企业策略）")
        @unknown default:
            call.reject("UNKNOWN", "未知权限状态")
        }
    }

    // MARK: - Private helpers

    private func authorizationStatus() -> PHAuthorizationStatus {
        return PHPhotoLibrary.authorizationStatus(for: .addOnly)
    }

    private func performSave(imageData: Data, filename: String, call: CAPPluginCall) {
        PHPhotoLibrary.shared().performChanges({
            let request = PHAssetCreationRequest.forAsset()
            request.addResource(with: .photo, data: imageData, options: nil)
        }) { success, error in
            DispatchQueue.main.async {
                if success {
                    call.resolve([
                        "success": true,
                        "filename": filename,
                    ])
                } else {
                    call.reject(
                        "SAVE_FAILED",
                        error?.localizedDescription ?? "保存到图库失败"
                    )
                }
            }
        }
    }
}

// MARK: - PHAuthorizationStatus → JS bridge

private extension PHAuthorizationStatus {
    var jsValue: String {
        switch self {
        case .authorized: return "authorized"
        case .limited: return "limited"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "not_determined"
        @unknown default: return "unknown"
        }
    }
}
