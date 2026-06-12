# Antigravity Account Swapper

Ứng dụng desktop tối giản (Electron, **macOS + Windows**) để chuyển nhanh giữa
nhiều tài khoản Google Antigravity bằng token JSON, kèm hiển thị quota còn lại
của từng account (Claude Opus / Claude Sonnet / Gemini Pro).

> Made by **Thành Nguyên**

## Tính năng
- Import token từ một **folder** các file JSON, hoặc từ **một file JSON** đơn lẻ
  (`[{ "email", "refresh_token" }]`; file dạng mảng sẽ import tất cả account bên trong).
- Hiển thị account + % quota còn lại theo model.
- **Switch account 1 chạm**: ghi OS credential store (macOS Keychain / Windows
  Credential Manager) + inject `state.vscdb` của Antigravity IDE, tự tắt & mở
  lại IDE để đăng nhập đúng tài khoản.

## Yêu cầu
- **macOS** (`/Applications/Antigravity.app`) hoặc **Windows** (Antigravity IDE
  cài trong `%LOCALAPPDATA%\Programs\...`).
- Node.js 18+ (khuyến nghị 20/24).

## Chạy
```bash
npm install
npm start
```
1. Bấm **＋ Import folder** (chọn folder token) hoặc **＋ Import file** (chọn 1 file JSON).
2. Mỗi account hiện ra với quota; bấm **Switch** để đăng nhập tài khoản đó.

## Build bản release
```bash
npm install
npm run pack       # build nhanh (thư mục) -> dist/
npm run dist       # macOS: .app + DMG -> dist/
npm run dist:win   # Windows: installer NSIS (.exe) -> dist/
```
> `sql.js` là WASM thuần (không có native module) nên có thể build bản Windows
> ngay trên máy macOS.
- Output ở `dist/` (đã gitignore). `.app` nằm tại `dist/mac-arm64/`.
- App **không code-sign** (`mac.identity = null`). Lần đầu mở, macOS chặn
  Gatekeeper → chuột phải vào app chọn **Open**, hoặc chạy
  `xattr -dr com.apple.quarantine "Antigravity Account Swapper.app"`.
- Mặc định build cho **arm64** (Apple Silicon). Muốn Intel/universal, sửa
  `build.mac.target[].arch` trong `package.json`.
- Icon đang dùng mặc định của Electron; thêm icon riêng bằng cách đặt
  `build/icon.icns` và khai báo `build.mac.icon`.

## Cách hoạt động
Antigravity 2.x lưu tài khoản đang đăng nhập trong OS credential store
(macOS Keychain `gemini`/`antigravity`; Windows Credential Manager target
`gemini:antigravity`) **và** trong `state.vscdb`
(`antigravityUnifiedStateSync.oauthToken` / `userStatus`). App ghi cả hai trong
lúc IDE đã tắt, rồi mở lại IDE. Chi tiết: xem `docs/system-architecture.md`.

## Lưu ý bảo mật
- File token chứa `refresh_token` thật — **không commit lên git** (đã có
  `.gitignore`).
- Dữ liệu account được lưu cục bộ tại `~/.antigravity-swapper/`.

## Cấu trúc
```
electron/   main process, preload, IPC
src/main/   core: oauth, quota, keychain, state-db, switch, import
renderer/   GUI (HTML/CSS/JS)
docs/       tài liệu kiến trúc & code standards
```
