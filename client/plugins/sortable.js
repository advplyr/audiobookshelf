export default function ({ $config }) {
  const script = document.createElement('script')
  script.type = 'text/javascript'
  script.src = `${$config.routerBasePath || ''}/libs/sortable.js`

  document.head.appendChild(script)
}