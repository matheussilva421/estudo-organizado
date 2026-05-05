export function renderSkeletonLoader() {
  return `
    <div class="loading-skeleton">
      <div class="skeleton-stats-grid">
        <div class="skeleton-stat-card">
          <div class="skeleton skeleton-stat-value"></div>
          <div class="skeleton skeleton-stat-label"></div>
        </div>
        <div class="skeleton-stat-card">
          <div class="skeleton skeleton-stat-value"></div>
          <div class="skeleton skeleton-stat-label"></div>
        </div>
        <div class="skeleton-stat-card">
          <div class="skeleton skeleton-stat-value"></div>
          <div class="skeleton skeleton-stat-label"></div>
        </div>
      </div>
      <div class="skeleton-card">
        <div class="skeleton-card-content">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton-chart"></div>
        </div>
      </div>
    </div>
  `;
}

export function renderSkeletonList(count = 5) {
  let html = '<div class="loading-skeleton"><div class="skeleton-list">';
  for (let i = 0; i < count; i++) {
    html += `
      <div class="skeleton-list-item">
        <div class="skeleton skeleton-list-icon"></div>
        <div class="skeleton-list-text">
          <div class="skeleton skeleton-text skeleton-text-width-md"></div>
          <div class="skeleton skeleton-text skeleton-text-width-sm"></div>
        </div>
      </div>
    `;
  }
  html += '</div></div>';
  return html;
}

export function renderSkeletonTable(rows = 5, cols = 4) {
  let html = '<div class="loading-skeleton"><table class="skeleton-table">';
  for (let i = 0; i < rows; i++) {
    html += '<tr>';
    for (let j = 0; j < cols; j++) {
      html += '<td><div class="skeleton skeleton-cell"></div></td>';
    }
    html += '</tr>';
  }
  html += '</table></div>';
  return html;
}
