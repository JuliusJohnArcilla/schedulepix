# SchedulePix

Browser-only schedule builder: upload images, drag them onto a time grid, style it, export PNG/JPG.

```
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

- Everything stays in your browser (IndexedDB). Use **Backup**/**Load** to move work between browsers.
- Drag an image from the left tray onto the schedule to place it anywhere as a free decoration (resize with the corner handle, rotate with the top handle, opacity/layer in the Image tab). Hold Shift while dropping, or click "+ Event" on a thumbnail, to put it in a time slot as an event instead. Drag events to move them; drag their bottom edge to resize.
- Double-click an empty slot to add an event. Ctrl+Z / Ctrl+Y undo/redo, Delete removes the selected event.
- Touch: press and hold ~0.2s on an image or event, then drag.
- Export… lets you pick PNG/JPG, 1x–3x scale, and transparent background (PNG).

See `docs/` for the approved spec and architecture.
