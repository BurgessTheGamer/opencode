// IOHK Replica JavaScript
document.addEventListener("DOMContentLoaded", function () {
  const eyeButton = document.getElementById("eye-button")
  const visualizationPanel = document.getElementById("visualization-panel")
  const closePanel = document.getElementById("close-panel")
  const vizItems = document.querySelectorAll(".viz-item")
  const iframe = document.getElementById("visualization-frame")
  const loading = document.querySelector(".loading")

  // Hide loading once iframe loads
  iframe.addEventListener("load", function () {
    loading.style.display = "none"
  })

  // Eye button click - toggle panel
  eyeButton.addEventListener("click", function () {
    visualizationPanel.classList.add("active")
  })

  // Close panel button
  closePanel.addEventListener("click", function () {
    visualizationPanel.classList.remove("active")
  })

  // Click outside panel to close
  document.addEventListener("click", function (e) {
    if (e.target === visualizationPanel) {
      visualizationPanel.classList.remove("active")
    }
  })

  // Visualization item clicks
  vizItems.forEach((item) => {
    item.addEventListener("click", function () {
      // Remove active class from all items
      vizItems.forEach((v) => v.classList.remove("active"))

      // Add active class to clicked item
      this.classList.add("active")

      // Get the URL
      const url = this.getAttribute("data-url")

      // Show loading
      loading.style.display = "block"

      // Fade out current iframe
      iframe.style.opacity = "0"

      // After fade out, change source
      setTimeout(() => {
        iframe.src = url

        // Fade back in after load
        iframe.addEventListener("load", function onLoad() {
          iframe.style.opacity = "1"
          loading.style.display = "none"
          iframe.removeEventListener("load", onLoad)
        })
      }, 300)

      // Close panel after selection
      setTimeout(() => {
        visualizationPanel.classList.remove("active")
      }, 500)
    })
  })

  // Add smooth transitions to iframe
  iframe.style.transition = "opacity 0.3s ease"

  // Keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    // ESC to close panel
    if (e.key === "Escape" && visualizationPanel.classList.contains("active")) {
      visualizationPanel.classList.remove("active")
    }

    // Spacebar to open panel (when not typing)
    if (e.key === " " && e.target === document.body) {
      e.preventDefault()
      visualizationPanel.classList.toggle("active")
    }
  })

  // Prevent scrolling when panel is open
  let scrollPosition = 0

  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.target.classList.contains("active")) {
        scrollPosition = window.pageYOffset
        document.body.style.position = "fixed"
        document.body.style.top = `-${scrollPosition}px`
        document.body.style.width = "100%"
      } else {
        document.body.style.position = ""
        document.body.style.top = ""
        document.body.style.width = ""
        window.scrollTo(0, scrollPosition)
      }
    })
  })

  observer.observe(visualizationPanel, {
    attributes: true,
    attributeFilter: ["class"],
  })
})
