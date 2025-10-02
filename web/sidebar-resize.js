// Sidebar resizer functionality
(function() {
  const resizer = document.getElementById('sidebar-resizer');
  const sidebar = document.querySelector('.sidebar');

  if (!resizer || !sidebar) return;

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    // Calculate new width (subtract because we're dragging from the left edge)
    const delta = startX - e.clientX;
    const newWidth = startWidth + delta;

    // Apply constraints
    const minWidth = parseInt(getComputedStyle(sidebar).minWidth) || 250;
    const maxWidth = parseInt(getComputedStyle(sidebar).maxWidth) || 600;

    const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

    sidebar.style.width = `${constrainedWidth}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Save the width to localStorage
      localStorage.setItem('sidebarWidth', sidebar.style.width);
    }
  });

  // Restore saved width on load
  const savedWidth = localStorage.getItem('sidebarWidth');
  if (savedWidth) {
    sidebar.style.width = savedWidth;
  }
})();

// Chat height resizer functionality
(function() {
  const chatResizer = document.getElementById('chat-resizer');
  const sidebarChat = document.querySelector('.sidebar-chat');

  if (!chatResizer || !sidebarChat) return;

  let isResizing = false;
  let startY = 0;
  let startHeight = 0;

  chatResizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startHeight = sidebarChat.offsetHeight;

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    // Calculate new height (subtract because we're dragging from the top edge)
    const delta = startY - e.clientY;
    const newHeight = startHeight + delta;

    // Apply constraints
    const minHeight = parseInt(getComputedStyle(sidebarChat).minHeight) || 150;
    const maxHeight = parseInt(getComputedStyle(sidebarChat).maxHeight) || 600;

    const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

    sidebarChat.style.height = `${constrainedHeight}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Save the height to localStorage
      localStorage.setItem('chatHeight', sidebarChat.style.height);
    }
  });

  // Restore saved height on load
  const savedHeight = localStorage.getItem('chatHeight');
  if (savedHeight) {
    sidebarChat.style.height = savedHeight;
  }
})();
