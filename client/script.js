// ======================
// SOCKET
// ======================

const socket = io()

// ======================
// GLOBAL STATE
// ======================

let currentMode = 'territory'
let selectedLayer = null
let selectedMarker = null
let loadingData = false
let suppressInputs = false
let saveTimeout = null
let onlineUsers = []

// ======================
// ONLINE UI
// ======================

const usersBox =
  document.createElement('div')

usersBox.className =
  'users-online'

document.body.appendChild(
  usersBox
)

// ======================
// MAP
// ======================

const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -2,
  maxZoom: 3
})

const bounds = [
  [0, 0],
  [1000, 1000]
]

L.imageOverlay(
  'map.jpg',
  bounds
).addTo(map)

map.fitBounds(bounds)

// ======================
// LAYERS
// ======================

const drawnItems =
  new L.FeatureGroup()

const markersLayer =
  new L.FeatureGroup()

map.addLayer(drawnItems)
map.addLayer(markersLayer)

// ======================
// ELEMENTS
// ======================

const sidebar =
  document.getElementById(
    'sidebar'
  )

const contextMenu =
  document.getElementById(
    'contextMenu'
  )

const pointEditor =
  document.getElementById(
    'pointEditor'
  )

const pointEditorText =
  document.getElementById(
    'pointEditorText'
  )

// ======================
// DRAW
// ======================

const drawControl =
  new L.Control.Draw({

    edit: {
      featureGroup:
        drawnItems
    },

    draw: {
      polygon: true,

      rectangle: false,
      circle: false,
      polyline: false,
      marker: false,
      circlemarker: false
    }
  })

map.addControl(
  drawControl
)

// ======================
// SAVE
// ======================

function debounceSave() {

  if (loadingData)
    return

  clearTimeout(saveTimeout)

  saveTimeout =
    setTimeout(() => {

      saveData()

    }, 2500)
}

async function saveData() {

  const territories = []

  drawnItems.eachLayer(
    layer => {

      territories.push({

        latlngs:
          layer.getLatLngs(),

        territoryData:
          layer.territoryData
      })
    }
  )

  const markers = []

  markersLayer.eachLayer(
    marker => {

      markers.push({

        latlng:
          marker.getLatLng(),

        color:
          marker.customColor,

        description:
          marker.customDescription
      })
    }
  )

  await fetch(
    '/territories',
    {

      method: 'POST',

      headers: {
        'Content-Type':
          'application/json'
      },

      body:
        JSON.stringify({

          territories,
          markers
        })
    }
  )
}

// ======================
// CLEAR
// ======================

function clearMap() {

  drawnItems.clearLayers()
  markersLayer.clearLayers()

  map.eachLayer(layer => {

    if (
      layer instanceof L.Marker
      &&
      layer.options.icon
    ) {

      map.removeLayer(layer)
    }
  })
}

// ======================
// LOAD
// ======================

async function loadData() {

  loadingData = true
  suppressInputs = true

  clearMap()

  const res =
    await fetch(
      '/territories'
    )

  const saved =
    await res.json()

  // ======================
  // TERRITORIES
  // ======================

  if (
    saved.territories
  ) {

    saved.territories
      .forEach(item => {

        const polygon =
          L.polygon(

            item.latlngs,

            {
              color:
                item
                .territoryData
                .color,

              fillColor:
                item
                .territoryData
                .color,

              fillOpacity: .35,

              weight: 3
            }
          )

        polygon.territoryData =
          item.territoryData

        addLayerEvents(
          polygon
        )

        drawnItems.addLayer(
          polygon
        )

        createTerritoryLogo(
          polygon
        )
      })
  }

  // ======================
  // MARKERS
  // ======================

  if (saved.markers) {

    saved.markers
      .forEach(m => {

        createMarker(
          m.latlng,
          m.color,
          m.description
        )
      })
  }

  loadingData = false

  setTimeout(() => {
    suppressInputs = false
  }, 300)
}

// ======================
// LOGO
// ======================

function createTerritoryLogo(
  layer
) {

  if (
    !layer
      .territoryData
      .logo
  ) return

  const center =
    layer
      .getBounds()
      .getCenter()

  const icon =
    L.divIcon({

      className:
        'territory-logo',

      html: `
        <img
          src="${layer.territoryData.logo}"
          class="territory-logo-img"
        />
      `,

      iconSize: [80,80]
    })

  const marker =
    L.marker(
      center,
      { icon }
    )

  marker.addTo(map)

  layer.logoMarker =
    marker
}

// ======================
// EVENTS
// ======================

function addLayerEvents(
  layer
) {

  layer.on(
    'click',
    () => {

      selectedLayer =
        layer

      openSidebar(
        layer
      )
    }
  )

  layer.on(
    'contextmenu',
    e => {

      selectedLayer =
        layer

      contextMenu
        .style
        .display =
          'block'

      contextMenu
        .style
        .left =
          e.originalEvent
            .pageX
          + 'px'

      contextMenu
        .style
        .top =
          e.originalEvent
            .pageY
          + 'px'
    }
  )
}

// ======================
// SIDEBAR
// ======================

function openSidebar(
  layer
) {

  sidebar.classList.add(
    'active'
  )

  const data =
    layer.territoryData

  document
    .getElementById(
      'territoryTitle'
    )
    .innerText =
      data.name

  document
    .getElementById(
      'nameInput'
    )
    .value =
      data.name

  document
    .getElementById(
      'descInput'
    )
    .value =
      data.description

  document
    .getElementById(
      'statusInput'
    )
    .value =
      data.status

  document
    .getElementById(
      'colorInput'
    )
    .value =
      data.color

  document
    .getElementById(
      'statusBadge'
    )
    .innerText =
      data.status
      .toUpperCase()

  renderGallery(
    data.images || []
  )

  renderLogo(
    data.logo
  )
}

// ======================
// RENDER
// ======================

function renderGallery(
  images
) {

  const gallery =
    document.getElementById(
      'gallery'
    )

  gallery.innerHTML = ''

  images.forEach(
    img => {

      const div =
        document
          .createElement(
            'div'
          )

      div.className =
        'gallery-item'

      div.innerHTML = `
        <img src="${img}" />
      `

      gallery.appendChild(
        div
      )
    }
  )
}

function renderLogo(src) {

  const preview =
    document.getElementById(
      'logoPreview'
    )

  const small =
    document.getElementById(
      'territoryLogoSmall'
    )

  preview.innerHTML = ''
  small.innerHTML = ''

  if (!src) return

  preview.innerHTML = `
    <img src="${src}" />
  `

  small.innerHTML = `
    <img src="${src}" />
  `
}

// ======================
// CREATE TERRITORY
// ======================

map.on(
  L.Draw.Event.CREATED,

  e => {

    if (
      currentMode
      !== 'territory'
    ) return

    const layer =
      e.layer

    layer.territoryData = {

      id:
        crypto.randomUUID(),

      name:
        'New Territory',

      description:
        '',

      status:
        'neutral',

      color:
        '#d4af37',

      logo:
        null,

      images:[]
    }

    layer.setStyle({

      color:'#d4af37',

      fillColor:'#d4af37',

      fillOpacity:.35,

      weight:3
    })

    addLayerEvents(
      layer
    )

    drawnItems.addLayer(
      layer
    )

    debounceSave()
  }
)

// ======================
// MARKERS
// ======================

function createMarker(
  latlng,
  color,
  description
) {

  const marker =
    L.circleMarker(
      latlng,
      {
        radius:10,
        color,
        fillColor:color,
        fillOpacity:1
      }
    )

  marker.customColor =
    color

  marker.customDescription =
    description || ''

  marker.bindTooltip(

    description || 'POINT',

    {
      permanent:true,
      direction:'top',
      offset:[0,-12]
    }
  )

  marker.on(
    'click',
    () => {

      selectedMarker =
        marker

      pointEditor.style.display =
        'flex'

      pointEditorText.value =
        marker.customDescription
    }
  )

  marker.addTo(
    markersLayer
  )
}

// ======================
// POINT SAVE
// ======================

document
  .getElementById(
    'savePointBtn'
  )
  .onclick = () => {

    if (!selectedMarker)
      return

    selectedMarker.customDescription =
      pointEditorText.value

    selectedMarker.setTooltipContent(
      pointEditorText.value
    )

    pointEditor.style.display =
      'none'

    debounceSave()
  }

// ======================
// POINT DELETE
// ======================

document
  .getElementById(
    'deletePointBtn'
  )
  .onclick = () => {

    if (!selectedMarker)
      return

    markersLayer.removeLayer(
      selectedMarker
    )

    pointEditor.style.display =
      'none'

    debounceSave()
  }

// ======================
// CLOSE POINT
// ======================

document
  .getElementById(
    'closePointBtn'
  )
  .onclick = () => {

    pointEditor.style.display =
      'none'
  }

// ======================
// MAP CLICK
// ======================

map.on(
  'click',
  e => {

    contextMenu
      .style
      .display =
        'none'

    if (
      currentMode
      === 'marker'
    ) {

      const pointName =
        prompt(
          'Nazwa punktu:'
        )

      if (!pointName)
        return

      const color =
        document
          .getElementById(
            'pointColorPicker'
          )
          .value

      createMarker(
        e.latlng,
        color,
        pointName
      )

      debounceSave()
    }
  }
)

// ======================
// MODES
// ======================

document
  .getElementById(
    'territoryModeBtn'
  )
  .onclick = () => {

    currentMode =
      'territory'
  }

document
  .getElementById(
    'markerModeBtn'
  )
  .onclick = () => {

    currentMode =
      'marker'
  }

// ======================
// INPUTS
// ======================

document
  .getElementById(
    'nameInput'
  )
  .oninput = e => {

    if (
      !selectedLayer
      ||
      suppressInputs
    ) return

    selectedLayer
      .territoryData
      .name =
        e.target.value

    document
      .getElementById(
        'territoryTitle'
      )
      .innerText =
        e.target.value

    debounceSave()
  }

document
  .getElementById(
    'descInput'
  )
  .oninput = e => {

    if (
      !selectedLayer
      ||
      suppressInputs
    ) return

    selectedLayer
      .territoryData
      .description =
        e.target.value

    debounceSave()
  }

document
  .getElementById(
    'statusInput'
  )
  .onchange = e => {

    if (
      !selectedLayer
      ||
      suppressInputs
    ) return

    selectedLayer
      .territoryData
      .status =
        e.target.value

    document
      .getElementById(
        'statusBadge'
      )
      .innerText =
        e.target.value
          .toUpperCase()

    debounceSave()
  }

document
  .getElementById(
    'colorInput'
  )
  .oninput = e => {

    if (
      !selectedLayer
      ||
      suppressInputs
    ) return

    selectedLayer
      .territoryData
      .color =
        e.target.value

    selectedLayer
      .setStyle({

        color:
          e.target.value,

        fillColor:
          e.target.value
      })

    debounceSave()
  }

// ======================
// LOGO INPUT
// ======================

document
  .getElementById(
    'logoInput'
  )
  .onchange = async e => {

    if (!selectedLayer)
      return

    const file =
      e.target.files[0]

    if (!file)
      return

    const formData =
      new FormData()

    formData.append(
      'file',
      file
    )

    try {

      const res =
        await fetch(
          '/upload',
          {
            method:'POST',
            body:formData
          }
        )

      const data =
        await res.json()

      if (!data.path)
        return

      selectedLayer
        .territoryData
        .logo =
          data.path

      if (
        selectedLayer.logoMarker
      ) {

        map.removeLayer(
          selectedLayer.logoMarker
        )
      }

      createTerritoryLogo(
        selectedLayer
      )

      renderLogo(
        data.path
      )

      saveData()

    } catch(err) {

      console.error(err)
    }
  }

// ======================
// IMAGE INPUT
// ======================

document
  .getElementById(
    'imageInput'
  )
  .onchange = async e => {

    if (!selectedLayer)
      return

    const files =
      Array.from(
        e.target.files
      )

    for (const file of files) {

      const formData =
        new FormData()

      formData.append(
        'file',
        file
      )

      try {

        const res =
          await fetch(
            '/upload',
            {
              method:'POST',
              body:formData
            }
          )

        const data =
          await res.json()

        if (!data.path)
          continue

        selectedLayer
          .territoryData
          .images
          .push(
            data.path
          )

      } catch(err) {

        console.error(err)
      }
    }

    renderGallery(
      selectedLayer
        .territoryData
        .images
    )

    saveData()
  }
// ======================
// SAVE BTN
// ======================

document
  .getElementById(
    'saveBtn'
  )
  .onclick = () => {

    saveData()
  }

// ======================
// CLEAR BTN
// ======================

document
  .getElementById(
    'clearBtn'
  )
  .onclick = async () => {

    await fetch(
      '/territories',
      {

        method:'POST',

        headers:{
          'Content-Type':
            'application/json'
        },

        body:
          JSON.stringify({

            territories:[],
            markers:[]
          })
      }
    )

    location.reload()
  }

// ======================
// SOCKET EVENTS
// ======================

socket.on(
  'users-update',
  users => {

    onlineUsers = users

    usersBox.innerHTML =
      `ONLINE: ${users.length}`
  }
)

socket.on(
  'live-update',
  async () => {

    if (selectedLayer)
      return

    await loadData()
  }
)

// ======================
// START
// ======================

loadData()