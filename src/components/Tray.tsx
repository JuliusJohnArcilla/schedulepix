import { useRef, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { ImgEntry } from '../types'

function Thumb({ img, onDelete, onEvent }: { img: ImgEntry; onDelete: () => void; onEvent: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: 'img:' + img.id, data: { type: 'image', imageId: img.id } })
  return (
    <div ref={setNodeRef} className={'thumb' + (isDragging ? ' dragging' : '')} {...attributes} {...listeners} title={img.name}>
      <img src={img.url} alt={img.name} draggable={false} />
      <span className="thumb-name">{img.name}</span>
      <button
        className="thumb-event"
        title="Add as a grid event"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={onEvent}
      >
        + Event
      </button>
      <button
        className="thumb-del"
        aria-label={`Delete ${img.name}`}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={onDelete}
      >
        ×
      </button>
    </div>
  )
}

export function Tray({ images, onAdd, onDelete, onEvent }: { images: ImgEntry[]; onAdd: (files: File[]) => void; onDelete: (id: string) => void; onEvent: (id: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <aside
      className={'tray' + (over ? ' over' : '')}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setOver(true)
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        onAdd([...e.dataTransfer.files])
      }}
    >
      <h2>Images</h2>
      <button className="btn primary full" onClick={() => input.current?.click()}>
        + Upload images
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          onAdd([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
      {images.length === 0 ? (
        <p className="empty">Drop image files here, or click Upload. Then drag them onto the schedule.</p>
      ) : (
        <>
          <p className="hint">Drag onto the schedule to place it anywhere as decoration. Hold Shift while dropping (or use + Event) to put it in a time slot.</p>
          <div className="thumbs">
            {images.map((i) => (
              <Thumb key={i.id} img={i} onDelete={() => onDelete(i.id)} onEvent={() => onEvent(i.id)} />
            ))}
          </div>
        </>
      )}
    </aside>
  )
}
