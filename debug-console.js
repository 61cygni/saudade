// Debug Console Module
// Only active when localDev is true

// Get localDev from window or default to false
const localDev = window.localDev || false;

// Debug: Log the value of localDev to browser console
console.log('[debug-console.js] window.localDev =', window.localDev, ', localDev =', localDev);

// Debug Console Setup
const debugConsole = document.getElementById("debug-console");
const debugConsoleContent = document.getElementById("debug-console-content");
const debugConsoleClear = document.getElementById("debug-console-clear");
const debugConsoleClose = document.getElementById("debug-console-close");
const debugConsoleTabs = document.getElementById("debug-console-tabs");
let debugConsoleVisible = false;
let activeTab = 'all'; // 'all' or 'high'
const debugMessages = [];
const highPriorityMessages = [];
const MAX_DEBUG_MESSAGES = 500;

// Show debug console only in local development
const SHOW_DEBUG_CONSOLE = localDev;

// Debug console functions
function debugLog(type, ...args) {
  const timestamp = new Date().toLocaleTimeString();
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
  
  const msg = { type, timestamp, message };
  debugMessages.push(msg);
  
  // Keep only the last MAX_DEBUG_MESSAGES
  if (debugMessages.length > MAX_DEBUG_MESSAGES) {
    debugMessages.shift();
  }
  
  // Update UI if console is visible
  if (debugConsoleVisible) {
    updateDebugConsole();
  }
}

// High priority debug logging function
function debugLogHigh(type, ...args) {
  const timestamp = new Date().toLocaleTimeString();
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
  
  const msg = { type, timestamp, message };
  
  // Add to both arrays
  debugMessages.push(msg);
  highPriorityMessages.push(msg);
  
  // Keep only the last MAX_DEBUG_MESSAGES
  if (debugMessages.length > MAX_DEBUG_MESSAGES) {
    debugMessages.shift();
  }
  if (highPriorityMessages.length > MAX_DEBUG_MESSAGES) {
    highPriorityMessages.shift();
  }
  
  // Update UI if console is visible
  if (debugConsoleVisible) {
    updateDebugConsole();
  }
}

function updateDebugConsole() {
  debugConsoleContent.innerHTML = '';
  
  // Get messages based on active tab
  const messagesToShow = activeTab === 'high' ? highPriorityMessages : debugMessages;
  
  messagesToShow.forEach(msg => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `debug-console-message ${msg.type}`;
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'debug-console-timestamp';
    timestampSpan.textContent = `[${msg.timestamp}]`;
    messageDiv.appendChild(timestampSpan);
    messageDiv.appendChild(document.createTextNode(msg.message));
    debugConsoleContent.appendChild(messageDiv);
  });
  
  // Auto-scroll to bottom
  debugConsoleContent.scrollTop = debugConsoleContent.scrollHeight;
}

function switchTab(tabName) {
  activeTab = tabName;
  
  // Update tab buttons
  const tabs = debugConsoleTabs.querySelectorAll('.debug-console-tab');
  tabs.forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Update content
  updateDebugConsole();
}

function toggleDebugConsole() {
  debugConsoleVisible = !debugConsoleVisible;
  if (debugConsoleVisible) {
    debugConsole.style.display = 'flex'; // Override inline style
    debugConsole.classList.add('visible');
    // Add welcome message if console is empty
    if (debugMessages.length === 0) {
      debugLog('info', 'Debug console initialized. Use showDebugConsole() or hideDebugConsole() to control visibility.');
    }
    updateDebugConsole();
  } else {
    debugConsole.style.display = 'none';
    debugConsole.classList.remove('visible');
  }
}

function showDebugConsole() {
  if (!debugConsoleVisible) {
    toggleDebugConsole();
  }
}

function hideDebugConsole() {
  if (debugConsoleVisible) {
    toggleDebugConsole();
  }
}

function clearDebugConsole() {
  if (activeTab === 'high') {
    highPriorityMessages.length = 0;
  } else {
    debugMessages.length = 0;
    highPriorityMessages.length = 0; // Clear both when clearing "All"
  }
  updateDebugConsole();
}

// Only set up debug console if localDev is true
console.log('[debug-console.js] SHOW_DEBUG_CONSOLE =', SHOW_DEBUG_CONSOLE, ', debugConsole =', debugConsole);
if (SHOW_DEBUG_CONSOLE && debugConsole) {
  console.log('[debug-console.js] Setting up debug console...');
  // Intercept console methods
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  const originalConsoleInfo = console.info;

  console.log = function(...args) {
    debugLog('log', ...args);
    originalConsoleLog.apply(console, args);
  };

  console.warn = function(...args) {
    debugLog('warn', ...args);
    originalConsoleWarn.apply(console, args);
  };

  console.error = function(...args) {
    debugLog('error', ...args);
    originalConsoleError.apply(console, args);
  };

  console.info = function(...args) {
    debugLog('info', ...args);
    originalConsoleInfo.apply(console, args);
  };

  // Setup debug console event listeners
  debugConsoleClear.addEventListener('click', clearDebugConsole);
  debugConsoleClose.addEventListener('click', toggleDebugConsole);

  // Setup tab switching
  const tabs = debugConsoleTabs.querySelectorAll('.debug-console-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  // Show debug console on startup
  console.log('[debug-console.js] Calling showDebugConsole()...');
  showDebugConsole();
  console.log('[debug-console.js] debugConsoleVisible =', debugConsoleVisible);
} else {
  console.log('[debug-console.js] NOT setting up debug console - condition failed');
  // Hide debug console element when not in localDev mode
  if (debugConsole) {
    debugConsole.style.display = 'none';
  }
}

// Expose functions globally for easy access
window.showDebugConsole = showDebugConsole;
window.hideDebugConsole = hideDebugConsole;
window.toggleDebugConsole = toggleDebugConsole;
window.debugLogHigh = debugLogHigh; // High priority logging function


window.showDebugConsole = showDebugConsole;
