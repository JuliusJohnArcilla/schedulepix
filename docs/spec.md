# SchedulePix spec (approved)

Browser-only schedule builder: set up a time grid, upload images, drag them onto time slots, style it, export PNG/JPG.

## Approved features
1. Configurable grid (days + labels, start/end hour, slot size)
2. Image tray (multi-upload, drag-in, thumbnails, delete, auto-downscale ~1600px)
3. Drag image from tray onto schedule (snap to slots, highlight)
4. Move/resize items (drag; numeric time/duration fields as fallback)
5. Item editor: title, notes, color, image fit, font size
6. Export PNG/JPG: scale 1x/2x/3x, background options
7. Theme controls: palettes, fonts, background, title banner, grid style, corner radius
8. Auto-save (IndexedDB) + JSON backup import/export
9. Overlap handling (side-by-side lanes)
10. Undo/redo
15. Touch/mobile drag support

## Non-goals (deferred to "Later")
- 11 Starter presets, 12 Multiple saved schedules, 13 Free-position canvas, 14 Month/list views

## Assumptions
Single user, no accounts, no backend; images never leave the machine.
