<html lang="en"><head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Hover-to-Reveal Sidebar</title>

    <!-- Inter font -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&amp;display=swap" rel="stylesheet">

    <!-- Tailwind CDN -->
    <script src="https://cdn.tailwindcss.com"></script>

    <!-- Lucide Icons -->
    <script src="https://unpkg.com/lucide@latest"></script>
  </head>
  <body class="min-h-screen bg-neutral-950 text-neutral-200 antialiased" style="font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial">
    <!-- Top bar -->
    <header class="sticky top-0 z-30 border-b border-white/10 bg-neutral-950/70 backdrop-blur">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div class="flex items-center gap-3">
          <div class="h-6 w-6 rounded-md bg-gradient-to-br from-fuchsia-500 to-indigo-500"></div>
          <nav class="hidden md:flex items-center gap-2 text-sm text-neutral-400">
            <span class="text-neutral-500">/</span>
            <span class="px-2 py-0.5 rounded-md bg-white/5 text-neutral-200">Personal</span>
            <span class="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-neutral-300">Free</span>
          </nav>
        </div>

        <div class="flex items-center gap-2">
          <button class="hidden sm:inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-neutral-200 hover:bg-white/[0.08]">
            <i data-lucide="sparkles" class="h-4 w-4"></i>
            Upgrade
          </button>
          <button class="hidden sm:inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-neutral-200 hover:bg-white/[0.08]">
            <i data-lucide="message-square" class="h-4 w-4"></i>
            Feedback
          </button>
          <div class="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm">
            <i data-lucide="gauge" class="h-4 w-4 text-neutral-300"></i>
            <span class="tabular-nums text-neutral-200">0.00</span>
          </div>
          <div class="relative">
            <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&amp;w=64&amp;auto=format&amp;fit=crop" alt="avatar" class="h-7 w-7 rounded-full ring-1 ring-white/10 object-cover">
          </div>
        </div>
      </div>
    </header>

    <!-- Collapse icon (hover target) -->
    <button id="collapseBtn" aria-label="Open sidebar" class="group fixed left-3 top-24 z-40 grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-neutral-900/80 text-neutral-300 shadow-sm hover:bg-neutral-800/80 hover:text-white">
      <i data-lucide="menu" class="h-4 w-4"></i>
      <span class="pointer-events-none absolute -right-2 top-1/2 hidden -translate-y-1/2 translate-x-full rounded-md border border-white/10 bg-neutral-900/90 px-2 py-1 text-xs text-neutral-200 shadow-sm group-hover:block">Sidebar</span>
    </button>

    <!-- Sidebar -->
    <aside id="sidebar" class="fixed inset-y-0 left-0 z-40 w-72 -translate-x-full border-r border-white/10 bg-neutral-900/90 backdrop-blur transition-transform duration-200 ease-out">
      <div class="flex h-full flex-col">
        <div class="flex items-center gap-2 px-4 py-4">
          <div class="h-7 w-7 rounded-md bg-gradient-to-br from-cyan-500 to-emerald-500"></div>
          <div class="flex-1">
            <p class="text-sm font-medium text-neutral-100">Workspace</p>
            <p class="text-xs text-neutral-400">user@example.com</p>
          </div>
        </div>
        <nav class="mt-2 flex-1 space-y-1 px-2">
          <a href="#" class="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-200 hover:bg-white/5">
            <i data-lucide="home" class="h-4 w-4 text-neutral-300"></i>
            Home
          </a>
          <a href="#" class="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-200 hover:bg-white/5">
            <i data-lucide="wand-2" class="h-4 w-4 text-neutral-300"></i>
            Agent
          </a>
          <a href="#" class="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-200 hover:bg-white/5">
            <i data-lucide="folder" class="h-4 w-4 text-neutral-300"></i>
            Projects
          </a>
          <a href="#" class="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-200 hover:bg-white/5">
            <i data-lucide="images" class="h-4 w-4 text-neutral-300"></i>
            Assets
          </a>
          <a href="#" class="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-200 hover:bg-white/5">
            <i data-lucide="settings" class="h-4 w-4 text-neutral-300"></i>
            Settings
          </a>
        </nav>
        <div class="border-t border-white/10 p-3">
          <button class="flex w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200 hover:bg-white/[0.08]">
            <i data-lucide="plus" class="h-4 w-4"></i>
            New Project
          </button>
        </div>
      </div>
    </aside>

    <!-- Scrim for mobile toggle -->
    <div id="scrim" class="pointer-events-none fixed inset-0 z-30 bg-black/40 opacity-0 transition-opacity duration-200"></div>

    <!-- Main content -->
    <main class="relative mx-auto flex max-w-5xl flex-col items-center px-4 pt-28">
      <h1 class="text-center text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight text-white">
        What can I help you build?
      </h1>

      <div class="mt-10 w-full rounded-2xl border border-white/10 bg-neutral-900/70 p-4 shadow-xl">
        <div class="flex items-center justify-between">
          <p class="text-sm text-neutral-400">Ask to build...</p>
          <button class="rounded-md bg-white text-neutral-900 px-3 py-1.5 text-sm font-medium">Upgrade</button>
        </div>
        <div class="mt-4 flex items-center gap-3">
          <button class="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-neutral-200 hover:bg-white/[0.08]">
            <i data-lucide="sliders-horizontal" class="h-4 w-4"></i>
            Agent
          </button>
        </div>
        <div class="mt-4 rounded-lg bg-white/5 px-3 py-2 text-sm text-neutral-300">
          You are out of free messages. <a href="#" class="text-emerald-400 hover:underline">Upgrade Plan</a>
        </div>
      </div>

      <div class="mx-auto mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <button class="flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/70 px-4 py-2 text-sm text-neutral-200 hover:bg-white/[0.08]">
          <i data-lucide="camera" class="h-4 w-4"></i>
          Clone a Screenshot
        </button>
        <button class="flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/70 px-4 py-2 text-sm text-neutral-200 hover:bg-white/[0.08]">
          <i data-lucide="box" class="h-4 w-4"></i>
          Import from Figma
        </button>
        <button class="flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/70 px-4 py-2 text-sm text-neutral-200 hover:bg-white/[0.08]">
          <i data-lucide="upload" class="h-4 w-4"></i>
          Upload a Project
        </button>
        <button class="flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/70 px-4 py-2 text-sm text-neutral-200 hover:bg-white/[0.08]">
          <i data-lucide="file-box" class="h-4 w-4"></i>
          Landing Page
        </button>
      </div>

      <section class="mx-auto mt-14 w-full">
        <img src="https://images.unsplash.com/photo-1549880338-65ddcdfd017b?q=80&amp;w=1600&amp;auto=format&amp;fit=crop" alt="hero" class="w-full rounded-xl border border-white/10 object-cover">
      </section>
    </main>

    <script>
      // Initialize lucide
      window.addEventListener('DOMContentLoaded', () => {
        if (window.lucide) lucide.createIcons();
      });

      const sidebar = document.getElementById('sidebar');
      const btn = document.getElementById('collapseBtn');
      const scrim = document.getElementById('scrim');

      let hideTimer;

      const openSidebar = () => {
        sidebar.classList.remove('-translate-x-full');
      };

      const closeSidebar = () => {
        sidebar.classList.add('-translate-x-full');
      };

      const hideWithDelay = () => {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          // Only auto-close on desktop hover interactions
          if (window.matchMedia('(hover: hover)').matches) closeSidebar();
        }, 120);
      };

      // Hover to reveal (desktop)
      btn.addEventListener('mouseenter', openSidebar);
      btn.addEventListener('mouseleave', hideWithDelay);
      sidebar.addEventListener('mouseenter', openSidebar);
      sidebar.addEventListener('mouseleave', hideWithDelay);

      // Tap to toggle (mobile / touch)
      const toggleMobile = () => {
        const isOpen = !sidebar.classList.contains('-translate-x-full');
        if (isOpen) {
          closeSidebar();
          scrim.classList.add('pointer-events-none');
          scrim.classList.remove('opacity-100');
        } else {
          openSidebar();
          scrim.classList.remove('pointer-events-none');
          scrim.classList.add('opacity-100');
        }
      };

      btn.addEventListener('click', () => {
        // If device supports hover, prioritize hover behavior. Otherwise toggle.
        if (!window.matchMedia('(hover: hover)').matches) toggleMobile();
      });

      scrim.addEventListener('click', () => {
        closeSidebar();
        scrim.classList.add('pointer-events-none');
        scrim.classList.remove('opacity-100');
      });

      // Keyboard support
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          closeSidebar();
          scrim.classList.add('pointer-events-none');
          scrim.classList.remove('opacity-100');
        }
      });
    </script>
  
</body></html>