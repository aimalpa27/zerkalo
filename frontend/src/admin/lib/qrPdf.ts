export type QrPdfCard = {
  tableNumber: number
  qrSvg: SVGSVGElement
}

const encoder = new TextEncoder()
const bytes = (s: string) => encoder.encode(s)

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) { out.set(p, offset); offset += p.length }
  return out
}

function dataUrlToBytes(url: string): Uint8Array {
  const b64 = url.slice(url.indexOf(',') + 1)
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

function svgToImage(svg: SVGSVGElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const xml = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось подготовить QR-код.')) }
    img.src = url
  })
}

async function renderPage(restaurantName: string, cards: QrPdfCard[]): Promise<Uint8Array> {
  // A4 portrait at ~150 dpi. Four large, print-friendly cards per page.
  const canvas = document.createElement('canvas')
  canvas.width = 1240
  canvas.height = 1754
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas недоступен в этом браузере.')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const margin = 54
  const gap = 26
  const cellW = (canvas.width - margin * 2 - gap) / 2
  const cellH = (canvas.height - margin * 2 - gap) / 2

  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i]
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = margin + col * (cellW + gap)
    const y = margin + row * (cellH + gap)

    ctx.strokeStyle = '#c8c8c8'
    ctx.lineWidth = 2
    ctx.setLineDash([10, 8])
    ctx.strokeRect(x, y, cellW, cellH)
    ctx.setLineDash([])

    ctx.fillStyle = '#111111'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '700 31px Arial, sans-serif'
    const safeName = restaurantName.trim() || 'Plait'
    ctx.fillText(safeName.length > 28 ? `${safeName.slice(0, 27)}…` : safeName, x + cellW / 2, y + 62)

    const qr = await svgToImage(card.qrSvg)
    const qrSize = Math.min(410, cellW - 110)
    ctx.drawImage(qr, x + (cellW - qrSize) / 2, y + 128, qrSize, qrSize)

    ctx.font = '800 44px Arial, sans-serif'
    ctx.fillText(`Стол №${card.tableNumber}`, x + cellW / 2, y + 128 + qrSize + 70)
    ctx.font = '500 21px Arial, sans-serif'
    ctx.fillStyle = '#555555'
    ctx.fillText('Сканируйте QR для меню и заказа', x + cellW / 2, y + 128 + qrSize + 118)
    ctx.font = '600 18px Arial, sans-serif'
    ctx.fillStyle = '#777777'
    ctx.fillText('plait.kz', x + cellW / 2, y + cellH - 44)
  }

  return dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.92))
}

function buildPdf(pageJpegs: Uint8Array[]): Blob {
  // Dependency-free PDF 1.4: each A4 page is one JPEG image. Rasterizing the
  // complete card also preserves Cyrillic restaurant/table text without
  // embedding a font file.
  const objects: Uint8Array[] = []
  const add = (body: Uint8Array | string) => { objects.push(typeof body === 'string' ? bytes(body) : body); return objects.length }

  const catalogId = add('')
  const pagesId = add('')
  const pageIds: number[] = []

  for (const jpg of pageJpegs) {
    const imageId = add(concat([
      bytes(`<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`),
      jpg,
      bytes('\nendstream'),
    ]))
    const content = bytes('q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n')
    const contentId = add(concat([bytes(`<< /Length ${content.length} >>\nstream\n`), content, bytes('endstream')]))
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`)
    pageIds.push(pageId)
  }

  objects[catalogId - 1] = bytes(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)
  objects[pagesId - 1] = bytes(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`)

  const chunks: Uint8Array[] = [bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')]
  const offsets = [0]
  let cursor = chunks[0].length
  objects.forEach((obj, i) => {
    offsets.push(cursor)
    const head = bytes(`${i + 1} 0 obj\n`)
    const tail = bytes('\nendobj\n')
    chunks.push(head, obj, tail)
    cursor += head.length + obj.length + tail.length
  })
  const xrefOffset = cursor
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i += 1) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  chunks.push(bytes(xref))
  return new Blob(chunks, { type: 'application/pdf' })
}

export async function downloadBulkQrPdf(restaurantName: string, cards: QrPdfCard[], filename = 'plait-qr-tables.pdf') {
  if (!cards.length) throw new Error('Нет столов для экспорта.')
  const pages: Uint8Array[] = []
  for (let i = 0; i < cards.length; i += 4) pages.push(await renderPage(restaurantName, cards.slice(i, i + 4)))
  const blob = buildPdf(pages)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
