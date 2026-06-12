# App icon

Quăng ảnh icon vào đây với tên **`icon.png`**:

```
icons/icon.png
```

## Yêu cầu ảnh
- Định dạng: **PNG**
- Kích thước: **1024 × 1024 px** (vuông, tối thiểu 512×512)
- Nền trong suốt (transparent) nếu muốn icon bo góc đẹp

electron-builder sẽ **tự động** sinh icon cho cả 3 nền tảng từ file này:
- macOS → `.icns`
- Windows → `.ico`
- Linux → `.png`

Không cần chỉnh gì thêm trong `package.json` — chỉ cần đặt đúng `icons/icon.png` là xong.

> Ảnh là `.jpg` hoặc sai kích thước? Cứ bỏ vào rồi nhờ mình convert sang `icon.png` 1024×1024 chuẩn.
