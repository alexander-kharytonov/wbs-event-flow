// Explicit printing of the already-rendered snapshot; no credentials or data.
document
  .getElementById("print-badges")
  ?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const error = document.getElementById("print-error");
    button.disabled = true;
    error.hidden = true;

    try {
      await document.fonts.ready;

      for (const image of document.querySelectorAll(
        "[data-badge-document] img",
      )) {
        await image.decode();
      }

      window.print();
    } catch {
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  });
