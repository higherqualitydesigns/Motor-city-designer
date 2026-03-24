document.querySelector('.contact-form')?.addEventListener('submit', (event) => {
  event.preventDefault();

  const button = event.currentTarget.querySelector('button');
  const originalLabel = button.textContent;

  button.textContent = 'Thanks! We will reach out soon.';
  button.disabled = true;

  window.setTimeout(() => {
    button.textContent = originalLabel;
    button.disabled = false;
    event.currentTarget.reset();
  }, 2500);
});
