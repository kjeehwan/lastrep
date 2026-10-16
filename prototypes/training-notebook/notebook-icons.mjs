// Approved outline vocabulary, copied from the reviewed Home study.
const paths = {
  info: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><path d="M12 11.5v5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 6 9 7 9-7"/>',
  document: '<path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6M9 16h6"/>',
  'move-up': '<path d="m7 14 5-5 5 5"/>',
  'move-down': '<path d="m7 10 5 5 5-5"/>',
  reorder: '<path d="M7 4v16m-3-3 3 3 3-3M17 20V4m-3 3 3-3 3 3"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  barcode: '<path d="M3 5v14M6 5v14M10 5v14M12 5v14M16 5v14M20 5v14"/><path d="M3 3H1v4M21 3h2v4M3 21H1v-4M21 21h2v-4"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v7h5"/>',

  calendar: '<rect x="4" y="5" width="16" height="16" rx="1"/><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6"/>',
  settings: '<path d="M4 6h5M13 6h7M4 12h10M18 12h2M4 18h2M10 18h10"/><circle cx="11" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>', down: '<path d="m7 10 5 5 5-5"/>',
  left: '<path d="m15 5-7 7 7 7"/>', right: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>', heart: '<path d="M12 21 4 13C-3 5 7 0 12 7c5-7 15-2 8 6Z"/>',
  home: '<path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/>',
  workout: '<path d="M2 12h20" stroke-width="1.5"/><path d="M7 5v14M17 5v14M4 9v6M20 9v6" stroke-width="2.1"/>',
  nutrition: '<path d="M12 7C4 2 1 10 5 17c2 5 5 4 7 3 2 1 5 2 7-3 4-7 1-15-7-10ZM12 7c0-4 3-5 6-5"/>',
  sleep: '<path d="M20 16A9 9 0 0 1 8 4a9 9 0 1 0 12 12Z"/>',
  profile: '<circle cx="12" cy="7" r="4"/><path d="M4 21c0-9 16-9 16 0Z"/>',
};
export const notebookIcon = name => `<svg class="icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.right}</svg>`;
