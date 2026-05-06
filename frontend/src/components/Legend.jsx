import React from 'react'

export default function Legend() {
  return (
    <div className="legend">
      <div className="legend-item">
        <span className="swatch" style={{ background: 'linear-gradient(180deg,#E71C24 0%,#C4171E 100%)' }} />
        Critical Path (zero slack)
      </div>
      <div className="legend-item">
        <span className="swatch" style={{ background: 'linear-gradient(180deg,#3777B6 0%,#284180 100%)' }} />
        Non-critical Task
      </div>
      <div className="legend-item">
        <span className="swatch" style={{ background: '#8CC0E5' }} />
        Phase Tag (in row)
      </div>
      <div className="legend-item">
        <span className="swatch" style={{ background: '#f4f4f4', border: '1px solid #ddd' }} />
        Sunday (no work)
      </div>
      <div className="legend-item" style={{ marginLeft: 'auto', fontStyle: 'italic', fontSize: 10 }}>
        Sorted by Early Start · Work week: Mon–Sat (6 days)
      </div>
    </div>
  )
}
