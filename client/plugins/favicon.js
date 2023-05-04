export default function ({ $config }) {
  const faviconPath = $config.favicon || '/favicon.ico'

  const link = document.createElement('link')
  link.rel = 'icon'
  link.type = 'image/x-icon'
  link.href = `${$config.public.routerBasePath || ''}${faviconPath}`

  document.head.appendChild(link)
}