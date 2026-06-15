'use client'
import React, { useState, useEffect, useRef } from 'react';
import AISettings from './AISettings';
import GenerateTodos from './GenerateTodos';
import { getProvider } from '../lib/aiProviders';

// Default tasks when no localStorage data is available
const defaultTasks = [
  { 
    id: '1', 
    text: 'Learn React', 
    description: '## Getting Started\n\nBegin with the official React docs at reactjs.org\n\n- Learn about components\n- Understand JSX syntax\n- Practice with small projects',
    done: true, 
    priority: 'medium',
    subtasks: [
      { id: 's1-1', text: 'Study components', done: true },
      { id: 's1-2', text: 'Learn hooks', done: false }
    ],
    order: 0,
    showNotes: false
  },
  { 
    id: '2', 
    text: 'Build task app', 
    description: 'Create a fully functional task management application with:\n\n1. Task creation/editing\n2. Subtasks\n3. Priority levels\n4. Pomodoro timer',
    done: false, 
    priority: 'high',
    subtasks: [
      { id: 's2-1', text: 'Create UI design', done: true },
      { id: 's2-2', text: 'Implement features', done: false }
    ],
    order: 1,
    showNotes: false
  },
  { 
    id: '3', 
    text: 'Deploy to production', 
    description: '',
    done: false, 
    priority: 'low',
    subtasks: [],
    order: 2,
    showNotes: false
  }
];

// Simple Markdown renderer for task descriptions
function renderMarkdown(markdown) {
  if (!markdown) return null;
  
  // Process line breaks
  let html = markdown.replace(/\n/g, '<br>');
  
  // Process headers
  html = html.replace(/## (.*?)\n/g, '<h2 class="text-xl font-bold mb-2">$1</h2>');
  html = html.replace(/# (.*?)\n/g, '<h1 class="text-2xl font-bold mb-3">$1</h1>');
  
  // Process bold text
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Process italic text
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Process unordered lists
  html = html.replace(/^\s*- (.*?)$/gm, '<li class="ml-5">$1</li>');
  html = html.replace(/<li.*?><\/li>/g, '');
  html = html.replace(/(<li.*?>.*?<\/li>)(\s*<li)/g, '<ul class="list-disc mb-3">$1$2');
  html = html.replace(/(<li.*?>.*?<\/li>)(?!\s*<li)/g, '<ul class="list-disc mb-3">$1</ul>');
  
  // Process ordered lists
  html = html.replace(/^\s*(\d+)\. (.*?)$/gm, '<li class="ml-5">$2</li>');
  html = html.replace(/(<li.*?>.*?<\/li>)(\s*<li)/g, '<ol class="list-decimal mb-3">$1$2');
  html = html.replace(/(<li.*?>.*?<\/li>)(?!\s*<li)/g, '<ol class="list-decimal mb-3">$1</ol>');
  
  return html;
}

function TaskMasterApp() {
  // States with initial default values
  const [isClient, setIsClient] = useState(false);
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [tasks, setTasks] = useState(defaultTasks);
  const [expandedTasks, setExpandedTasks] = useState({});
  const [newTask, setNewTask] = useState("");
  const [priority, setPriority] = useState("medium");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSubtaskParent, setActiveSubtaskParent] = useState(null);
  const [newSubtaskText, setNewSubtaskText] = useState("");
  
  // Editing states
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [editText, setEditText] = useState("");
  const editInputRef = useRef(null);
  
  // Notes editing states
  const [editingNotesTaskId, setEditingNotesTaskId] = useState(null);
  const [editingNotes, setEditingNotes] = useState("");
  const notesTextareaRef = useRef(null);
  
  // Drag and drop states
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [draggedSubtaskId, setDraggedSubtaskId] = useState(null);
  const [draggedTaskParentId, setDraggedTaskParentId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [dragOverSubtaskId, setDragOverSubtaskId] = useState(null);
  const [isTouch, setIsTouch] = useState(false);
  
  // Timer states
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [timerMode, setTimerMode] = useState('pomodoro');
  const [customTime, setCustomTime] = useState(25);
  const [activeTask, setActiveTask] = useState(null);
  
  // Animation states
  const [recentlyCompleted, setRecentlyCompleted] = useState(null);

  // AI states
  const [aiSettings, setAiSettings] = useState({ provider: '', apiKey: '', model: '' });
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState(null); // { codex, ollama }
  const [aiLoadingId, setAiLoadingId] = useState(null); // task id (or '__new__') currently generating
  const [aiMessage, setAiMessage] = useState(null); // { type: 'error'|'success', text }
  const [generateOpen, setGenerateOpen] = useState(false);
  const [showTopBtn, setShowTopBtn] = useState(false);

  // Smooth-scroll to a section by id
  const scrollToId = (id) => {
    if (typeof document !== 'undefined') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Timer durations (in minutes)
  const timerDurations = {
    pomodoro: 25,
    shortBreak: 5,
    longBreak: 15,
    custom: customTime
  };
  
  // Focus edit input when it appears
  useEffect(() => {
    if ((editingTaskId || editingSubtaskId) && editInputRef.current) {
      editInputRef.current.focus();
      // Place cursor at the end of the text
      editInputRef.current.selectionStart = editInputRef.current.value.length;
    }
  }, [editingTaskId, editingSubtaskId]);
  
  // Focus notes textarea when editing notes
  useEffect(() => {
    if (editingNotesTaskId && notesTextareaRef.current) {
      notesTextareaRef.current.focus();
      // Place cursor at the end of the text
      notesTextareaRef.current.selectionStart = notesTextareaRef.current.value.length;
    }
  }, [editingNotesTaskId]);
  
  // Detect touch device
  useEffect(() => {
    if (isClient) {
      const isTouchDevice = ('ontouchstart' in window) || 
        (navigator.maxTouchPoints > 0) || 
        (navigator.msMaxTouchPoints > 0);
      setIsTouch(isTouchDevice);
    }
  }, [isClient]);
  
  // Set isClient to true once component mounts to avoid hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // v2 redesign: drive the CSS token theme off darkMode (light/dark var sets)
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  // Show the floating "back to top" button once the user scrolls down
  useEffect(() => {
    const onScroll = () => setShowTopBtn(window.scrollY > 220);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  
  // Load data from localStorage only after component is mounted on client
  useEffect(() => {
    if (isClient) {
      // Load tasks
      const savedTasks = localStorage.getItem('taskMasterTasks');
      if (savedTasks) {
        try {
          setTasks(JSON.parse(savedTasks));
          setLoadedFromStorage(true);
          setTimeout(() => setLoadedFromStorage(false), 1000);
        } catch (e) {
          console.error('Failed to parse saved tasks:', e);
        }
      }
      
      // Load expanded tasks
      const savedExpandedTasks = localStorage.getItem('taskMasterExpandedTasks');
      if (savedExpandedTasks) {
        try {
          setExpandedTasks(JSON.parse(savedExpandedTasks));
        } catch (e) {
          console.error('Failed to parse saved expanded tasks:', e);
        }
      }
      
      // Load dark mode
      const savedDarkMode = localStorage.getItem('taskMasterDarkMode');
      if (savedDarkMode !== null) {
        try {
          setDarkMode(JSON.parse(savedDarkMode));
        } catch (e) {
          console.error('Failed to parse saved dark mode preference:', e);
        }
      }

      // Load AI settings
      const savedAi = localStorage.getItem('taskMasterAISettings');
      if (savedAi) {
        try {
          setAiSettings(JSON.parse(savedAi));
        } catch (e) {
          console.error('Failed to parse saved AI settings:', e);
        }
      }

      // Detect local, no-key providers (Codex CLI / Ollama)
      fetch('/api/ai/status')
        .then((r) => r.json())
        .then((s) => setAiStatus(s))
        .catch(() => setAiStatus({ codex: false, ollama: false }));
    }
  }, [isClient]);

  // Persist AI settings whenever they change
  useEffect(() => {
    if (isClient) {
      localStorage.setItem('taskMasterAISettings', JSON.stringify(aiSettings));
    }
  }, [aiSettings, isClient]);

  // Auto-dismiss AI toast
  useEffect(() => {
    if (aiMessage) {
      const t = setTimeout(() => setAiMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [aiMessage]);
  
  // Save tasks to localStorage whenever they change (but only on client)
  useEffect(() => {
    if (isClient) {
      localStorage.setItem('taskMasterTasks', JSON.stringify(tasks));
    }
  }, [tasks, isClient]);

  // Save expanded tasks state
  useEffect(() => {
    if (isClient) {
      localStorage.setItem('taskMasterExpandedTasks', JSON.stringify(expandedTasks));
    }
  }, [expandedTasks, isClient]);

  // Save dark mode preference
  useEffect(() => {
    if (isClient) {
      localStorage.setItem('taskMasterDarkMode', JSON.stringify(darkMode));
    }
  }, [darkMode, isClient]);
  
  // Sort tasks by order
  const sortedTasks = [...tasks].sort((a, b) => {
    // If order property exists, use it, otherwise use array index
    const orderA = a.order !== undefined ? a.order : tasks.indexOf(a);
    const orderB = b.order !== undefined ? b.order : tasks.indexOf(b);
    return orderA - orderB;
  });
  
  // Format time for timer display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Timer functions
  const startTimer = () => {
    setIsTimerActive(true);
  };
  
  const pauseTimer = () => {
    setIsTimerActive(false);
  };
  
  const resetTimer = () => {
    setIsTimerActive(false);
    setTimeLeft(timerDurations[timerMode] * 60);
  };
  
  const changeTimerMode = (mode) => {
    setTimerMode(mode);
    setIsTimerActive(false);
    setTimeLeft(timerDurations[mode] * 60);
  };
  
  const setCustomTimer = (minutes) => {
    const validMinutes = Math.max(1, Math.min(120, minutes));
    setCustomTime(validMinutes);
    if (timerMode === 'custom') {
      setTimeLeft(validMinutes * 60);
    }
  };
  
  // Timer effect
  useEffect(() => {
    let interval = null;
    
    if (isTimerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prevTime => prevTime - 1);
      }, 1000);
    } else if (isTimerActive && timeLeft === 0) {
      setIsTimerActive(false);
      alert("Timer finished!");
    }
    
    return () => clearInterval(interval);
  }, [isTimerActive, timeLeft]);
  
  // Start timer for a specific task
  const startTimerForTask = (taskId, subtaskId = null) => {
    // Find the task
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Set active task with info
    let taskInfo = {
      id: taskId,
      text: task.text,
      subtaskId: subtaskId
    };
    
    // If it's a subtask, add the subtask text
    if (subtaskId) {
      const subtask = task.subtasks.find(s => s.id === subtaskId);
      if (subtask) {
        taskInfo.subtaskText = subtask.text;
      }
    }
    
    // Set as active task and start timer
    setActiveTask(taskInfo);
    
    // Auto-select Pomodoro mode when starting from a task
    if (timerMode !== 'pomodoro') {
      changeTimerMode('pomodoro');
    } else {
      // If already in Pomodoro mode, just start the timer
      setIsTimerActive(true);
    }

    // Scroll to the top so the active task + countdown are in view
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  // Stop timer and clear active task
  const stopTimerAndClear = () => {
    pauseTimer();
    setActiveTask(null);
  };

  // Complete the focused task/subtask straight from the Pomodoro card, then clear focus.
  // Only ever marks done (never un-completes an already-done item).
  const completeActiveTask = () => {
    if (!activeTask) return;
    const task = tasks.find(t => t.id === activeTask.id);
    if (activeTask.subtaskId) {
      const sub = task?.subtasks?.find(s => s.id === activeTask.subtaskId);
      if (sub && !sub.done) toggleSubtask(activeTask.id, activeTask.subtaskId);
    } else if (task && !task.done) {
      toggleTask(activeTask.id);
    }
    stopTimerAndClear();
  };
  
  // Toggle dark mode
  const toggleDarkMode = () => setDarkMode(!darkMode);
  
  // Add new task
  const addTask = () => {
    if (!newTask.trim()) return;
    
    // Find the maximum order value to add new task at the end
    const maxOrder = tasks.length > 0 
      ? Math.max(...tasks.map(t => t.order !== undefined ? t.order : 0))
      : -1;
      
    const task = {
      id: Date.now().toString(),
      text: newTask,
      description: '',
      done: false,
      priority,
      subtasks: [],
      order: maxOrder + 1,  // Add at the end
      showNotes: false
    };
    
    setTasks([...tasks, task]);
    setNewTask("");
    return task;
  };

  // --- AI subtask breakdown ---

  // Whether the chosen provider is ready to use
  const aiConfigured = () => {
    const p = getProvider(aiSettings.provider);
    if (!p) return false;
    if (p.needsKey && !aiSettings.apiKey) return false;
    return true;
  };

  // Append AI-generated subtasks to a task and expand it
  const addSubtasksToTask = (taskId, texts) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const base = t.subtasks.length;
      const newSubs = texts.map((text, i) => ({
        id: `s${taskId}-${Date.now()}-${i}`,
        text,
        done: false,
        order: base + i,
      }));
      return { ...t, subtasks: [...t.subtasks, ...newSubs] };
    }));
    setExpandedTasks(prev => ({ ...prev, [taskId]: true }));
  };

  // Ask the model to break a goal into subtasks for the given task.
  // notes = the task's Markdown description; existing = current subtask texts.
  const aiBreakdown = async (goal, taskId, { notes = '', existing = [] } = {}) => {
    if (!aiConfigured()) {
      setAiSettingsOpen(true);
      return;
    }
    setAiLoadingId(taskId);
    setAiMessage(null);
    try {
      const res = await fetch('/api/ai/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: aiSettings.provider,
          apiKey: aiSettings.apiKey,
          model: aiSettings.model || undefined,
          goal,
          notes,
          existing,
          count: 5,
        }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.subtasks) || data.subtasks.length === 0) {
        throw new Error(data.error || 'No subtasks returned');
      }
      addSubtasksToTask(taskId, data.subtasks);
      setAiMessage({ type: 'success', text: `Added ${data.subtasks.length} AI subtasks` });
    } catch (e) {
      setAiMessage({ type: 'error', text: String(e.message || e) });
    } finally {
      setAiLoadingId(null);
    }
  };

  // Add a new task from the input, then immediately break it down with AI
  const addTaskWithAI = async () => {
    if (!newTask.trim()) return;
    if (!aiConfigured()) {
      setAiSettingsOpen(true);
      return;
    }
    const goal = newTask;
    const created = addTask();
    if (created) await aiBreakdown(goal, created.id);
  };

  // Add an AI-generated project to-do list as ONE parent task with the items as subtasks
  const addTasksFromList = (texts, parentLabel) => {
    if (!texts || !texts.length) return;
    const id = Date.now().toString();
    setTasks(prev => {
      const maxOrder = prev.length > 0
        ? Math.max(...prev.map(t => (t.order !== undefined ? t.order : 0)))
        : -1;
      const parent = {
        id,
        text: parentLabel || 'Generated to-dos',
        description: '',
        done: false,
        priority: 'medium',
        subtasks: texts.map((text, i) => ({ id: `s${id}-${i}`, text, done: false, order: i })),
        order: maxOrder + 1,
        showNotes: false,
      };
      return [...prev, parent];
    });
    setExpandedTasks(prev => ({ ...prev, [id]: true })); // expand so the subtasks show
    setAiMessage({ type: 'success', text: `Added "${parentLabel}" with ${texts.length} subtasks` });
  };

  // Toggle task completion with animation
  const toggleTask = (id) => {
    const task = tasks.find(t => t.id === id);
    const isCompleting = task && !task.done;
    
    if (isCompleting) {
      // Show completion animation by setting recently completed
      setRecentlyCompleted(id);
      // Remove the animation class after a delay
      setTimeout(() => setRecentlyCompleted(null), 1000);
    }
    
    setTasks(tasks.map(task => 
      task.id === id ? {...task, done: !task.done} : task
    ));
  };
  
  // Delete a task
  const deleteTask = (id) => {
    setTasks(tasks.filter(task => task.id !== id));
    // Clear active subtask parent if deleted
    if (activeSubtaskParent === id) {
      setActiveSubtaskParent(null);
    }
  };
  
  // Toggle task expansion for subtasks
  const toggleTaskExpansion = (taskId) => {
    setExpandedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
    
    if (!expandedTasks[taskId]) {
      setActiveSubtaskParent(taskId);
    } else if (activeSubtaskParent === taskId) {
      setActiveSubtaskParent(null);
    }
  };
  
  // Toggle notes visibility
  const toggleNotes = (taskId) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? {...task, showNotes: !task.showNotes} : task
    ));
  };
  
  // Start editing notes
  const startEditingNotes = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setEditingNotesTaskId(taskId);
      setEditingNotes(task.description || '');
      
      // Make sure notes are visible
      if (!task.showNotes) {
        toggleNotes(taskId);
      }
    }
  };
  
  // Cancel editing notes
  const cancelEditingNotes = () => {
    setEditingNotesTaskId(null);
    setEditingNotes('');
  };
  
  // Save notes
  const saveNotes = () => {
    if (editingNotesTaskId) {
      setTasks(tasks.map(task => 
        task.id === editingNotesTaskId 
          ? {...task, description: editingNotes} 
          : task
      ));
      cancelEditingNotes();
    }
  };
  
  // Add a subtask
  const addSubtask = () => {
    if (!newSubtaskText.trim() || !activeSubtaskParent) return;
    
    setTasks(tasks.map(task => {
      if (task.id === activeSubtaskParent) {
        const order = task.subtasks.length;
        return {
          ...task,
          subtasks: [
            ...task.subtasks,
            {
              id: `s${activeSubtaskParent}-${Date.now()}`,
              text: newSubtaskText,
              done: false,
              order: order  // Add order property
            }
          ]
        };
      }
      return task;
    }));
    
    setNewSubtaskText('');
  };
  
  // Toggle subtask completion with animation
  const toggleSubtask = (taskId, subtaskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const subtask = task.subtasks.find(s => s.id === subtaskId);
    const isCompleting = subtask && !subtask.done;
    
    if (isCompleting) {
      // Show completion animation
      setRecentlyCompleted(subtaskId);
      // Remove the animation class after a delay
      setTimeout(() => setRecentlyCompleted(null), 1000);
    }
    
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          subtasks: task.subtasks.map(subtask => 
            subtask.id === subtaskId
              ? { ...subtask, done: !subtask.done }
              : subtask
          )
        };
      }
      return task;
    }));
  };
  
  // Delete a subtask
  const deleteSubtask = (taskId, subtaskId) => {
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          subtasks: task.subtasks.filter(subtask => subtask.id !== subtaskId)
        };
      }
      return task;
    }));
  };
  
  // Start editing a task
  const startEditingTask = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setEditingTaskId(taskId);
      setEditingSubtaskId(null);
      setEditText(task.text);
    }
  };
  
  // Start editing a subtask
  const startEditingSubtask = (taskId, subtaskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const subtask = task.subtasks.find(s => s.id === subtaskId);
    if (subtask) {
      setEditingTaskId(taskId);
      setEditingSubtaskId(subtaskId);
      setEditText(subtask.text);
    }
  };
  
  // Cancel editing
  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditingSubtaskId(null);
    setEditText("");
  };
  
  // Submit edit
  const submitEdit = () => {
    if (!editText.trim()) {
      // Don't allow empty text
      cancelEditing();
      return;
    }
    
    if (editingTaskId && !editingSubtaskId) {
      // Editing a task
      setTasks(tasks.map(task => 
        task.id === editingTaskId 
          ? { ...task, text: editText.trim() } 
          : task
      ));
    } else if (editingTaskId && editingSubtaskId) {
      // Editing a subtask
      setTasks(tasks.map(task => {
        if (task.id === editingTaskId) {
          return {
            ...task,
            subtasks: task.subtasks.map(subtask => 
              subtask.id === editingSubtaskId 
                ? { ...subtask, text: editText.trim() } 
                : subtask
            )
          };
        }
        return task;
      }));
    }
    
    cancelEditing();
  };
  
  // Handle edit form submission
  const handleEditFormSubmit = (e) => {
    e.preventDefault();
    submitEdit();
  };
  
  // Move task up (alternative to drag-and-drop)
  const moveTaskUp = (taskId) => {
    const taskIndex = sortedTasks.findIndex(t => t.id === taskId);
    if (taskIndex <= 0) return; // Already at the top
    
    const currentTask = sortedTasks[taskIndex];
    const taskAbove = sortedTasks[taskIndex - 1];
    
    // Swap orders
    const updatedTasks = tasks.map(t => {
      if (t.id === currentTask.id) {
        return { ...t, order: taskAbove.order };
      }
      if (t.id === taskAbove.id) {
        return { ...t, order: currentTask.order };
      }
      return t;
    });
    
    setTasks(updatedTasks);
  };
  
  // Move task down (alternative to drag-and-drop)
  const moveTaskDown = (taskId) => {
    const taskIndex = sortedTasks.findIndex(t => t.id === taskId);
    if (taskIndex >= sortedTasks.length - 1 || taskIndex < 0) return; // Already at the bottom
    
    const currentTask = sortedTasks[taskIndex];
    const taskBelow = sortedTasks[taskIndex + 1];
    
    // Swap orders
    const updatedTasks = tasks.map(t => {
      if (t.id === currentTask.id) {
        return { ...t, order: taskBelow.order };
      }
      if (t.id === taskBelow.id) {
        return { ...t, order: currentTask.order };
      }
      return t;
    });
    
    setTasks(updatedTasks);
  };
  
  // Drag and drop functions for tasks - ENHANCED VERSION
  const handleDragStart = (e, taskId) => {
    // Cancel if we're editing
    if (editingTaskId || editingSubtaskId || editingNotesTaskId) {
      e.preventDefault();
      return;
    }
    
    e.stopPropagation();
    
    try {
      // Set data transfer immediately for better browser compatibility
      e.dataTransfer.setData('text/plain', taskId);
      e.dataTransfer.effectAllowed = 'move';
      
      // Use a small delay to set state after dataTransfer
      setTimeout(() => {
        setDraggedTaskId(taskId);
        
        // Try to add a class to the dragged element
        try {
          const element = document.getElementById(`task-${taskId}`);
          if (element) element.classList.add('dragging');
        } catch (err) {
          console.log('Error adding dragging class:', err);
        }
      }, 10);
    } catch (error) {
      console.log('Error in handleDragStart:', error);
      // Fallback - just set the state
      setDraggedTaskId(taskId);
    }
  };
  
  const handleDragOver = (e, taskId) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (draggedTaskId && draggedTaskId !== taskId) {
        setDragOverTaskId(taskId);
      }
      
      // Explicitly set dropEffect for better browser compatibility
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
    } catch (error) {
      console.log('Error in handleDragOver:', error);
    }
  };
  
  const handleDragEnter = (e, taskId) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (draggedTaskId && draggedTaskId !== taskId) {
        setDragOverTaskId(taskId);
      }
    } catch (error) {
      console.log('Error in handleDragEnter:', error);
    }
  };
  
  const handleDragLeave = (e, taskId) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (dragOverTaskId === taskId) {
        setDragOverTaskId(null);
      }
    } catch (error) {
      console.log('Error in handleDragLeave:', error);
    }
  };
  
  const handleDragEnd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      // Remove drag classes
      try {
        const draggingElements = document.querySelectorAll('.dragging');
        draggingElements.forEach(el => el.classList.remove('dragging'));
      } catch (err) {
        console.log('Error removing dragging class:', err);
      }
      
      // Reset drag states
      setDraggedTaskId(null);
      setDragOverTaskId(null);
    } catch (error) {
      console.log('Error in handleDragEnd:', error);
    }
  };
  
  const handleDrop = (e, targetTaskId) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      // Get the dragged task ID from dataTransfer if possible
      let sourceTaskId;
      
      try {
        sourceTaskId = e.dataTransfer.getData('text/plain');
      } catch (err) {
        console.log('Error getting data from dataTransfer:', err);
        sourceTaskId = draggedTaskId;
      }
      
      if (!sourceTaskId || sourceTaskId === targetTaskId) {
        handleDragEnd(e);
        return;
      }
      
      // Reorder tasks
      const updatedTasks = [...tasks];
      const sourceTask = updatedTasks.find(t => t.id === sourceTaskId);
      const targetTask = updatedTasks.find(t => t.id === targetTaskId);
      
      if (sourceTask && targetTask) {
        // Swap their order properties
        const temp = sourceTask.order !== undefined ? sourceTask.order : tasks.indexOf(sourceTask);
        sourceTask.order = targetTask.order !== undefined ? targetTask.order : tasks.indexOf(targetTask);
        targetTask.order = temp;
        
        setTasks(updatedTasks);
      }
    } catch (error) {
      console.log('Error in handleDrop:', error);
    }
    
    // Always clean up at the end
    handleDragEnd(e);
  };
  
  // Drag and drop functions for subtasks - ENHANCED VERSION
  const handleSubtaskDragStart = (e, taskId, subtaskId) => {
    // Cancel if we're editing
    if (editingTaskId || editingSubtaskId || editingNotesTaskId) {
      e.preventDefault();
      return;
    }
    
    e.stopPropagation(); // Prevent parent task drag from triggering
    
    try {
      // Set data transfer immediately for better browser compatibility
      e.dataTransfer.setData('taskId', taskId);
      e.dataTransfer.setData('subtaskId', subtaskId);
      e.dataTransfer.effectAllowed = 'move';
      
      // Use a small delay to set state after dataTransfer
      setTimeout(() => {
        setDraggedSubtaskId(subtaskId);
        setDraggedTaskParentId(taskId);
        
        // Try to add a class to the dragged element
        try {
          const element = document.getElementById(`subtask-${subtaskId}`);
          if (element) element.classList.add('dragging');
        } catch (err) {
          console.log('Error adding dragging class to subtask:', err);
        }
      }, 10);
    } catch (error) {
      console.log('Error in handleSubtaskDragStart:', error);
      // Fallback - just set the state
      setDraggedSubtaskId(subtaskId);
      setDraggedTaskParentId(taskId);
    }
  };
  
  const handleSubtaskDragOver = (e, taskId, subtaskId) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent parent handlers from triggering
    
    try {
      if (draggedSubtaskId && draggedSubtaskId !== subtaskId && 
          draggedTaskParentId === taskId) {
        setDragOverSubtaskId(subtaskId);
      }
      
      // Explicitly set dropEffect for better browser compatibility
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
    } catch (error) {
      console.log('Error in handleSubtaskDragOver:', error);
    }
  };
  
  const handleSubtaskDragEnter = (e, taskId, subtaskId) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (draggedSubtaskId && draggedSubtaskId !== subtaskId && 
          draggedTaskParentId === taskId) {
        setDragOverSubtaskId(subtaskId);
      }
    } catch (error) {
      console.log('Error in handleSubtaskDragEnter:', error);
    }
  };
  
  const handleSubtaskDragLeave = (e, taskId, subtaskId) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (dragOverSubtaskId === subtaskId) {
        setDragOverSubtaskId(null);
      }
    } catch (error) {
      console.log('Error in handleSubtaskDragLeave:', error);
    }
  };
  
  const handleSubtaskDragEnd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      // Remove drag classes
      try {
        const draggingElements = document.querySelectorAll('.dragging');
        draggingElements.forEach(el => el.classList.remove('dragging'));
      } catch (err) {
        console.log('Error removing dragging class from subtask:', err);
      }
      
      // Reset drag states
      setDraggedSubtaskId(null);
      setDraggedTaskParentId(null);
      setDragOverSubtaskId(null);
    } catch (error) {
      console.log('Error in handleSubtaskDragEnd:', error);
    }
  };
  
  const handleSubtaskDrop = (e, taskId, targetSubtaskId) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent parent handlers from triggering
    
    try {
      // Get the dragged subtask ID from dataTransfer if possible
      let sourceSubtaskId, sourceTaskId;
      
      try {
        sourceTaskId = e.dataTransfer.getData('taskId');
        sourceSubtaskId = e.dataTransfer.getData('subtaskId');
      } catch (err) {
        console.log('Error getting subtask data from dataTransfer:', err);
        sourceTaskId = draggedTaskParentId;
        sourceSubtaskId = draggedSubtaskId;
      }
      
      if (!sourceSubtaskId || 
          sourceSubtaskId === targetSubtaskId || 
          sourceTaskId !== taskId) {
        handleSubtaskDragEnd(e);
        return;
      }
      
      // Find the task containing these subtasks
      const updatedTasks = [...tasks];
      const taskIndex = updatedTasks.findIndex(t => t.id === taskId);
      
      if (taskIndex !== -1) {
        const task = updatedTasks[taskIndex];
        
        // Sort subtasks by order first
        const sortedSubtasks = [...task.subtasks].sort((a, b) => {
          const orderA = a.order !== undefined ? a.order : task.subtasks.indexOf(a);
          const orderB = b.order !== undefined ? b.order : task.subtasks.indexOf(b);
          return orderA - orderB;
        });
        
        const sourceSubtask = task.subtasks.find(st => st.id === sourceSubtaskId);
        const targetSubtask = task.subtasks.find(st => st.id === targetSubtaskId);
        
        if (sourceSubtask && targetSubtask) {
          // Get the current orders
          const sourceOrder = sourceSubtask.order !== undefined ? 
            sourceSubtask.order : sortedSubtasks.findIndex(s => s.id === sourceSubtaskId);
          const targetOrder = targetSubtask.order !== undefined ? 
            targetSubtask.order : sortedSubtasks.findIndex(s => s.id === targetSubtaskId);
          
          // Swap their order properties
          updatedTasks[taskIndex] = {
            ...task,
            subtasks: task.subtasks.map(subtask => {
              if (subtask.id === sourceSubtaskId) {
                return { ...subtask, order: targetOrder };
              }
              if (subtask.id === targetSubtaskId) {
                return { ...subtask, order: sourceOrder };
              }
              return subtask;
            })
          };
          
          setTasks(updatedTasks);
        }
      }
    } catch (error) {
      console.log('Error in handleSubtaskDrop:', error);
    }
    
    // Always clean up at the end
    handleSubtaskDragEnd(e);
  };
  
  // Get task progress
  const getTaskProgress = (task) => {
    if (task.subtasks.length === 0) return task.done ? 100 : 0;
    
    const completedSubtasks = task.subtasks.filter(st => st.done).length;
    return Math.round((completedSubtasks / task.subtasks.length) * 100);
  };
  
  // Get priority styles
  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'high': return darkMode ? 'bg-red-900 text-red-400' : 'bg-red-50 text-red-600';
      case 'medium': return darkMode ? 'bg-yellow-900 text-yellow-400' : 'bg-yellow-50 text-yellow-600';
      case 'low': return darkMode ? 'bg-green-900 text-green-400' : 'bg-green-50 text-green-600';
      default: return darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600';
    }
  };
  
  // Filter and sort tasks based on search
  const filteredTasks = searchTerm ? 
    sortedTasks.filter(task => {
      const taskMatches = task.text.toLowerCase().includes(searchTerm.toLowerCase());
      const descriptionMatches = task.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const subtaskMatches = task.subtasks.some(subtask => 
        subtask.text.toLowerCase().includes(searchTerm.toLowerCase())
      );
      return taskMatches || descriptionMatches || subtaskMatches;
    }) : 
    sortedTasks;

  return (
    <div className="max-w-2xl mx-auto p-4 rounded-lg">
      {/* Storage Notification - only show on client side */}
      {isClient && loadedFromStorage && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50">
          Data loaded from storage!
        </div>
      )}

      {/* AI toast */}
      {aiMessage && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded shadow-lg z-50 max-w-md text-center
          ${aiMessage.type === 'error' ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white'}`}>
          {aiMessage.type === 'error' ? '⚠️ ' : '✨ '}{aiMessage.text}
        </div>
      )}

      {/* AI settings drawer */}
      <AISettings
        open={aiSettingsOpen}
        onClose={() => setAiSettingsOpen(false)}
        settings={aiSettings}
        onSave={setAiSettings}
        darkMode={darkMode}
        status={aiStatus}
      />

      {/* Generate a to-do list from a project */}
      <GenerateTodos
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        aiSettings={aiSettings}
        configured={aiConfigured()}
        darkMode={darkMode}
        onAddTasks={addTasksFromList}
        onOpenSettings={() => { setGenerateOpen(false); setAiSettingsOpen(true); }}
        status={aiStatus}
      />
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl ql-wordmark"><span className="q">Quiet</span>List</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAiSettingsOpen(true)}
            className={`px-3 py-2 rounded-full btn-animation text-sm font-medium ${aiConfigured() ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            title="AI settings"
          >
            ✨ AI{aiConfigured() ? '' : ' setup'}
          </button>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full bg-gray-200 btn-animation"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/* Quick navigation */}
      <div className="ql-nav">
        <button onClick={() => scrollToId('ql-focus-section')} className="ql-nav-btn"><span className="ql-nav-ic">◷</span> Focus</button>
        <button onClick={() => scrollToId('ql-add-section')} className="ql-nav-btn"><span className="ql-nav-ic">＋</span> Add task</button>
        <button onClick={() => scrollToId('ql-tasks-section')} className="ql-nav-btn"><span className="ql-nav-ic">☰</span> Tasks</button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tasks and subtasks..."
            className="w-full p-2 rounded border"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-2"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Focus session (Pomodoro) */}
      <div id="ql-focus-section" className="ql-focus mb-4">
        <div className="ql-focus-main">
          <div className="ql-focus-label">Focus session</div>
          {activeTask ? (
            <div className="ql-focus-now">
              Working on <b>{activeTask.text}</b>
              {activeTask.subtaskId && <span className="ql-focus-sub"> ➤ {activeTask.subtaskText}</span>}
              <span className="ql-focus-actions">
                <button onClick={completeActiveTask} className="ql-focus-done" title="Mark this task complete">✓ Complete</button>
                <button onClick={stopTimerAndClear} className="ql-focus-clear">Clear</button>
              </span>
            </div>
          ) : (
            <div className="ql-focus-now ql-muted">No task selected — tap ⏱️ on a task, or just focus.</div>
          )}

          <div className="ql-modes">
            <button onClick={() => changeTimerMode('pomodoro')} className={`ql-mode ${timerMode === 'pomodoro' ? 'active' : ''}`}>Pomodoro · 25</button>
            <button onClick={() => changeTimerMode('shortBreak')} className={`ql-mode ${timerMode === 'shortBreak' ? 'active' : ''}`}>Short · 5</button>
            <button onClick={() => changeTimerMode('longBreak')} className={`ql-mode ${timerMode === 'longBreak' ? 'active' : ''}`}>Long · 15</button>
            <button onClick={() => changeTimerMode('custom')} className={`ql-mode ${timerMode === 'custom' ? 'active' : ''}`}>Custom</button>
          </div>

          {timerMode === 'custom' && (
            <div className="ql-custom">
              <input
                type="number"
                min="1"
                max="120"
                value={customTime}
                onChange={(e) => setCustomTimer(parseInt(e.target.value) || 1)}
                className="ql-custom-input"
              />
              <span>min</span>
              <button onClick={() => setTimeLeft(customTime * 60)} className="ql-custom-apply">Apply</button>
            </div>
          )}

          <div className="ql-quick">
            {[10, 15, 20, 30, 45, 60].map((m) => (
              <button
                key={m}
                onClick={() => { setCustomTime(m); setCustomTimer(m); changeTimerMode('custom'); }}
                className="ql-quick-btn"
              >
                {m}m
              </button>
            ))}
          </div>
        </div>

        <div className="ql-clock">
          <div className={`ql-time ${isTimerActive ? 'running' : ''}`}>
            {(() => { const [mm, ss] = formatTime(timeLeft).split(':'); return (<>{mm}<span className="ql-sep">:</span>{ss}</>); })()}
          </div>
          <div className="ql-clock-row">
            {!isTimerActive ? (
              <button onClick={startTimer} className="ql-play">Start</button>
            ) : (
              <button onClick={pauseTimer} className="ql-play running">Pause</button>
            )}
            <button onClick={resetTimer} className="ql-ghost">Reset</button>
          </div>
        </div>
      </div>

      {/* Add Task Form */}
      <div id="ql-add-section" className="mb-4 p-4 border rounded">
        <h2 className="text-lg font-medium mb-2">Add New Task</h2>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="What needs to be done?"
            className="p-2 border rounded"
          />
          <div className="flex space-x-2">
            <select 
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <button
              onClick={addTask}
              className="px-4 py-2 bg-blue-600 text-white rounded flex-grow btn-animation"
            >
              Add Task
            </button>
            <button
              onClick={addTaskWithAI}
              disabled={!!aiLoadingId}
              className="px-4 py-2 bg-indigo-600 text-white rounded btn-animation disabled:opacity-60"
              title={aiConfigured() ? 'Add task and auto-generate subtasks' : 'Set up AI first'}
            >
              {aiLoadingId ? '⏳ Thinking…' : '✨ Add + AI Subtasks'}
            </button>
          </div>
          <button
            onClick={() => (aiConfigured() ? setGenerateOpen(true) : setAiSettingsOpen(true))}
            className="mt-1 px-4 py-2 border-2 border-indigo-500 text-indigo-500 rounded btn-animation text-sm font-medium hover:bg-indigo-50"
            title="Generate a whole to-do list from a folder or GitHub repo"
          >
            📂 Generate to-do list from a project
          </button>
        </div>
      </div>

      {/* Task List with drag and drop and notes - ENHANCED VERSION */}
      <div id="ql-tasks-section">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-medium">
            {searchTerm ? `Search Results (${filteredTasks.length})` : `Tasks (${tasks.length})`}
          </h2>
          {isClient && !searchTerm && (
            <div className="text-sm text-gray-500">
              {isTouch ? 'Use arrows to reorder' : 'Drag tasks to reorder'}
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          {filteredTasks.map((task, taskIndex) => {
            const progress = getTaskProgress(task);
            const isRecentlyCompleted = recentlyCompleted === task.id;
            const isFirst = taskIndex === 0;
            const isLast = taskIndex === filteredTasks.length - 1;
            const isEditing = editingTaskId === task.id && editingSubtaskId === null;
            const isEditingNotes = editingNotesTaskId === task.id;
            const hasNotes = task.description && task.description.trim().length > 0;
            
            // Sort subtasks if they have order property
            const sortedSubtasks = [...task.subtasks].sort((a, b) => {
              const orderA = a.order !== undefined ? a.order : task.subtasks.indexOf(a);
              const orderB = b.order !== undefined ? b.order : task.subtasks.indexOf(b);
              return orderA - orderB;
            });
            
            return (
              <div
                key={task.id}
                id={`task-${task.id}`}
                style={{ animationDelay: `${taskIndex * 45}ms` }}
                className={`ql-card border rounded overflow-hidden transition-all duration-300
                  ${task.done ? 'opacity-80' : ''}
                  ${isRecentlyCompleted ? 'completed-animation' : ''}
                  ${draggedTaskId === task.id ? 'opacity-50 border-dashed' : ''}
                  ${dragOverTaskId === task.id ? 'border-blue-500 border-2' : ''}
                `}
                draggable={isClient && !searchTerm && !isTouch && !isEditing && !isEditingNotes}
                onDragStart={(e) => handleDragStart(e, task.id)}
                onDragOver={(e) => handleDragOver(e, task.id)}
                onDragEnter={(e) => handleDragEnter(e, task.id)}
                onDragLeave={(e) => handleDragLeave(e, task.id)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, task.id)}
              >
                <div className="p-3 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {/* Drag handle or arrows for touch devices */}
                    {isClient && !searchTerm && !isEditing && !isEditingNotes && (
                      <>
                        {isTouch ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => moveTaskUp(task.id)}
                              disabled={isFirst}
                              className={`px-1 py-0.5 rounded ${isFirst ? 'opacity-50 cursor-not-allowed' : 'bg-blue-500 text-white'}`}
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveTaskDown(task.id)}
                              disabled={isLast}
                              className={`px-1 py-0.5 rounded ${isLast ? 'opacity-50 cursor-not-allowed' : 'bg-blue-500 text-white'}`}
                            >
                              ↓
                            </button>
                          </div>
                        ) : (
                          <div className="cursor-grab text-gray-400 px-1">
                            ≡
                          </div>
                        )}
                      </>
                    )}
                    
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => toggleTask(task.id)}
                      className="h-5 w-5 rounded-md border-2"
                      disabled={isEditing || isEditingNotes}
                    />
                    
                    {/* Task text or edit form */}
                    {isEditing ? (
                      <form 
                        onSubmit={handleEditFormSubmit}
                        className="flex-grow flex items-center"
                      >
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="p-1 border rounded flex-grow text-black"
                          ref={editInputRef}
                          autoFocus
                        />
                        <div className="flex gap-1 ml-1">
                          <button
                            type="submit"
                            className="px-2 py-1 bg-green-500 text-white rounded text-sm"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="px-2 py-1 bg-red-500 text-white rounded text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div 
                        className={`flex items-center gap-2 ${task.done ? 'line-through' : ''}`}
                      >
                        <span 
                          className="cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded"
                          onClick={() => startEditingTask(task.id)}
                        >
                          {task.text}
                        </span>
                        <button
                          onClick={() => startEditingTask(task.id)}
                          className="text-gray-500 hover:text-gray-800 text-xs"
                          title="Edit task"
                        >
                          ✎
                        </button>
                        <span className={`text-xs px-2 py-1 rounded-full ${getPriorityClass(task.priority)}`}>
                          {task.priority}
                        </span>
                        {task.subtasks.length > 0 && (
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-200">
                            {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}
                          </span>
                        )}
                        {hasNotes && (
                          <span 
                            className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 cursor-pointer"
                            onClick={() => toggleNotes(task.id)}
                            title="This task has notes"
                          >
                            📝
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {!isEditing && !isEditingNotes && (
                    <div className="flex gap-2">
                      {/* Notes button */}
                      <button 
                        onClick={() => toggleNotes(task.id)}
                        className={`px-2 py-1 rounded ${task.showNotes ? 'bg-purple-500 text-white' : 'bg-purple-100 text-purple-800'} btn-animation`}
                        title={task.showNotes ? "Hide notes" : "Show/add notes"}
                      >
                        {task.showNotes ? '📝 ▼' : '📝'}
                      </button>
                      
                      {/* AI subtasks button */}
                      <button
                        onClick={() => aiBreakdown(task.text, task.id, {
                          notes: task.description,
                          existing: task.subtasks.map(s => s.text),
                        })}
                        disabled={aiLoadingId === task.id}
                        className="px-2 py-1 rounded bg-indigo-500 text-white btn-animation disabled:opacity-60"
                        title={aiConfigured() ? 'Generate subtasks with AI' : 'Set up AI first'}
                      >
                        {aiLoadingId === task.id ? '⏳' : '✨'}
                      </button>

                      {/* Subtasks button */}
                      <button
                        onClick={() => toggleTaskExpansion(task.id)}
                        className={`px-2 py-1 rounded ${expandedTasks[task.id] ? 'bg-gray-300' : 'bg-green-500 text-white'} btn-animation`}
                        title={expandedTasks[task.id] ? "Hide subtasks" : "Add subtasks"}
                      >
                        {expandedTasks[task.id] ? '▼' : '+'}
                      </button>
                      
                      {/* Timer button */}
                      <button
                        onClick={() => startTimerForTask(task.id)}
                        className={`px-2 py-1 rounded ${activeTask?.id === task.id && !activeTask?.subtaskId ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'} btn-animation`}
                        title="Start timer for this task"
                      >
                        ⏱️
                      </button>
                      
                      <button 
                        onClick={() => deleteTask(task.id)}
                        className="text-red-500 btn-animation"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Notes section */}
                {task.showNotes && (
                  <div className={`p-3 ${darkMode ? 'bg-gray-800' : 'bg-blue-50'} border-t task-notes`}>
                    {isEditingNotes ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center mb-1">
                          <h3 className="text-sm font-medium">Edit Notes</h3>
                          <div className="text-xs text-gray-500">Supports Markdown</div>
                        </div>
                        <textarea
                          value={editingNotes}
                          onChange={(e) => setEditingNotes(e.target.value)}
                          className="w-full p-2 border rounded text-black min-h-32"
                          placeholder="Add notes with Markdown support...
# Heading 1
## Heading 2
**Bold text**
*Italic text*
- Bullet point
1. Numbered item"
                          ref={notesTextareaRef}
                        />
                        <div className="flex justify-end gap-2 mt-1">
                          <button
                            onClick={cancelEditingNotes}
                            className="px-3 py-1 bg-gray-300 text-gray-800 rounded text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveNotes}
                            className="px-3 py-1 bg-green-500 text-white rounded text-sm"
                          >
                            Save Notes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="text-sm font-medium">Notes</h3>
                          <button
                            onClick={() => startEditingNotes(task.id)}
                            className="px-2 py-1 bg-blue-500 text-white rounded text-xs"
                          >
                            Edit Notes
                          </button>
                        </div>
                        {task.description ? (
                          <div 
                            className="markdown-content text-sm"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(task.description) }}
                          ></div>
                        ) : (
                          <div className="text-center p-4 text-gray-500 italic">
                            No notes yet. Click "Edit Notes" to add some.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Progress bar */}
                {task.subtasks.length > 0 && (
                  <div className="px-3">
                    <div className="w-full bg-gray-200 h-1">
                      <div 
                        className="bg-blue-600 h-1 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                
                {/* Subtasks with drag and drop */}
                {expandedTasks[task.id] && (
                  <div className="bg-gray-100 p-3">
                    {/* Add subtask form */}
                    <div className="flex mb-2">
                      <input 
                        type="text"
                        value={newSubtaskText}
                        onChange={(e) => setNewSubtaskText(e.target.value)}
                        placeholder="Add a subtask..."
                        className="p-1 text-sm border rounded-l flex-grow"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addSubtask();
                        }}
                      />
                      <button
                        onClick={addSubtask}
                        className="px-2 py-1 bg-blue-600 text-white rounded-r text-sm btn-animation"
                      >
                        Add
                      </button>
                    </div>
                    
                    {/* Subtasks list */}
                    <div className="space-y-1">
                      {isClient && !searchTerm && sortedSubtasks.length > 1 && (
                        <div className="text-xs text-gray-500 mb-1">
                          {isTouch ? 'Use arrows to reorder subtasks' : 'Drag subtasks to reorder'}
                        </div>
                      )}
                      
                      {sortedSubtasks.length > 0 ? (
                        sortedSubtasks.map((subtask, subtaskIndex) => {
                          const isSubtaskRecentlyCompleted = recentlyCompleted === subtask.id;
                          const isFirstSubtask = subtaskIndex === 0;
                          const isLastSubtask = subtaskIndex === sortedSubtasks.length - 1;
                          const isEditingSubtask = editingTaskId === task.id && editingSubtaskId === subtask.id;
                          
                          return (
                            <div 
                              key={subtask.id}
                              id={`subtask-${subtask.id}`}
                              className={`flex items-center justify-between p-2 bg-white rounded transition-all duration-300 
                                ${subtask.done ? 'opacity-80' : ''} 
                                ${isSubtaskRecentlyCompleted ? 'completed-animation' : ''}
                                ${draggedSubtaskId === subtask.id ? 'opacity-50 border-dashed' : ''}
                                ${dragOverSubtaskId === subtask.id ? 'border border-blue-500' : ''}
                              `}
                              draggable={isClient && !searchTerm && !isTouch && !isEditingSubtask && !isEditingNotes}
                              onDragStart={(e) => handleSubtaskDragStart(e, task.id, subtask.id)}
                              onDragOver={(e) => handleSubtaskDragOver(e, task.id, subtask.id)}
                              onDragEnter={(e) => handleSubtaskDragEnter(e, task.id, subtask.id)}
                              onDragLeave={(e) => handleSubtaskDragLeave(e, task.id, subtask.id)}
                              onDragEnd={handleSubtaskDragEnd}
                              onDrop={(e) => handleSubtaskDrop(e, task.id, subtask.id)}
                            >
                              <div className="flex items-center gap-2 flex-grow">
                                {/* Drag handle or arrows for touch devices */}
                                {isClient && !searchTerm && !isEditingSubtask && !isEditingNotes && (
                                  <>
                                    {isTouch ? (
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => {
                                            const taskObj = tasks.find(t => t.id === task.id);
                                            if (taskObj) moveSubtaskUp(task.id, subtask.id);
                                          }}
                                          disabled={isFirstSubtask}
                                          className={`px-0.5 text-xs rounded ${isFirstSubtask ? 'opacity-50 cursor-not-allowed' : 'bg-blue-500 text-white'}`}
                                        >
                                          ↑
                                        </button>
                                        <button
                                          onClick={() => {
                                            const taskObj = tasks.find(t => t.id === task.id);
                                            if (taskObj) moveSubtaskDown(task.id, subtask.id);
                                          }}
                                          disabled={isLastSubtask}
                                          className={`px-0.5 text-xs rounded ${isLastSubtask ? 'opacity-50 cursor-not-allowed' : 'bg-blue-500 text-white'}`}
                                        >
                                          ↓
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="cursor-grab text-gray-400 text-xs px-1">
                                        ≡
                                      </div>
                                    )}
                                  </>
                                )}
                                
                                <input
                                  type="checkbox"
                                  checked={subtask.done}
                                  onChange={() => toggleSubtask(task.id, subtask.id)}
                                  className="h-4 w-4 rounded-sm"
                                  disabled={isEditingSubtask}
                                />
                                
                                {/* Subtask text or edit form */}
                                {isEditingSubtask ? (
                                  <form 
                                    onSubmit={handleEditFormSubmit}
                                    className="flex-grow flex items-center"
                                  >
                                    <input
                                      type="text"
                                      value={editText}
                                      onChange={(e) => setEditText(e.target.value)}
                                      className="p-1 border rounded flex-grow text-black text-sm"
                                      ref={editInputRef}
                                      autoFocus
                                    />
                                    <div className="flex gap-1 ml-1">
                                      <button
                                        type="submit"
                                        className="px-1.5 py-0.5 bg-green-500 text-white rounded text-xs"
                                      >
                                        ✓
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelEditing}
                                        className="px-1.5 py-0.5 bg-red-500 text-white rounded text-xs"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  <div className="flex items-center gap-1.5 flex-grow">
                                    <span 
                                      className={`cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded flex-grow ${subtask.done ? 'line-through text-gray-500' : ''}`}
                                      onClick={() => startEditingSubtask(task.id, subtask.id)}
                                    >
                                      {subtask.text}
                                    </span>
                                    <button
                                      onClick={() => startEditingSubtask(task.id, subtask.id)}
                                      className="text-gray-500 hover:text-gray-800 text-xs"
                                      title="Edit subtask"
                                    >
                                      ✎
                                    </button>
                                    
                                    {/* Subtask timer button */}
                                    <button
                                      onClick={() => startTimerForTask(task.id, subtask.id)}
                                      className={`px-1 py-0.5 rounded text-xs ${
                                        activeTask?.id === task.id && activeTask?.subtaskId === subtask.id 
                                        ? 'bg-red-500 text-white' 
                                        : 'bg-blue-500 text-white'
                                      } btn-animation`}
                                      title="Start timer for this subtask"
                                    >
                                      ⏱️
                                    </button>
                                  </div>
                                )}
                              </div>
                              {!isEditingSubtask && (
                                <button
                                  onClick={() => deleteSubtask(task.id, subtask.id)}
                                  className="text-red-500 text-xs"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-gray-500 italic">No subtasks yet</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {filteredTasks.length === 0 && (
            <div className="text-center p-4 border rounded">
              {tasks.length === 0 ? 'No tasks yet' : 'No matching tasks'}
            </div>
          )}
        </div>
      </div>

      {/* Floating back-to-top */}
      {isClient && showTopBtn && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="ql-fab" title="Back to top">↑</button>
      )}

      {/* CSS for drag and drop */}
      <style jsx global>{`
        .dragging {
          opacity: 0.5 !important;
          border: 2px dashed #ccc !important;
          cursor: grabbing !important;
        }
        
        [draggable="true"] {
          cursor: grab;
          user-select: none;
          -webkit-user-drag: element;
          -khtml-user-drag: element;
          -moz-user-drag: element;
          -o-user-drag: element;
        }
        
        .pulse-animation {
          animation: pulse 1s infinite;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.8; }
          100% { opacity: 1; }
        }
        
        .completed-animation {
          animation: flash 1s;
        }
        
        @keyframes flash {
          0% { background-color: transparent; }
          30% { background-color: rgba(34, 197, 94, 0.2); }
          100% { background-color: transparent; }
        }
        
        .btn-animation {
          transition: transform 0.1s;
        }
        
        .btn-animation:active {
          transform: scale(0.95);
        }
        
        .task-notes h1 {
          font-size: 1.5rem;
          font-weight: bold;
          margin-bottom: 0.75rem;
        }
        
        .task-notes h2 {
          font-size: 1.25rem;
          font-weight: bold;
          margin-bottom: 0.5rem;
        }
        
        .task-notes ul, .task-notes ol {
          margin-bottom: 0.75rem;
          padding-left: 1.25rem;
        }
        
        .task-notes ul {
          list-style-type: disc;
        }
        
        .task-notes ol {
          list-style-type: decimal;
        }
        
        .task-notes strong {
          font-weight: bold;
        }
        
        .task-notes em {
          font-style: italic;
        }
      `}</style>
    </div>
  );
}

export default TaskMasterApp;