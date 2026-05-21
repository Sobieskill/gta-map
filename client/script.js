// ======================
// SOCKET.IO
// ======================

const socket = io()

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
// STATE
// ======================

let currentMode =
  'territory'

let selectedLayer =
  null

let activeLocks = {}

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

// ======================
// DRAW CONTROL
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
// HELPERS
// ======================

function setAccent(color) {

  document.documentElement
    .style.setProperty(
      '--accent',
      color
    )
}

// ======================
// SAVE
// ======================

async function saveData() {

  const territories = []

  drawnItems.eachLayer(layer => {

    territories.push({

      latlngs:
        layer.getLatLngs(),

      territoryData:
        layer.territoryData
    })
  })

  const markers = []

  markersLayer.eachLayer(marker => {

    markers.push({

      latlng:
        marker.getLatLng(),

      color:
        marker.customColor,

      description:
        marker.description
    })
  })

  const payload = {
    territories,
    markers
  }

  try {

    const res = await fetch(
      '/territories',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body:
          JSON.stringify(
            payload
          )
      }
    )

    const data =
      await res.json()

    console.log(
      'SAVE OK',
      data
    )

  } catch(err) {

    console.error(err)
  }
}

// ======================
// CLEAR MAP
// ======================

function clearMap() {

  drawnItems.clearLayers()

  markersLayer.clearLayers()

  map.eachLayer(layer => {

    if (
      layer instanceof L.Marker
      &&
      layer.options.icon
      &&
      layer.options.icon.options
      &&
      layer.options.icon.options.className
      === 'territory-logo'
    ) {

      map.removeLayer(layer)
    }
  })
}

// ======================
// LOAD
// ======================

async function loadData() {

  try {

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

  } catch(err) {

    console.error(err)
  }
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
// LAYER EVENTS
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

  const id =
    layer
      .territoryData
      .id

  if (
    activeLocks[id]
    &&
    activeLocks[id]
    !== socket.id
  ) {

    alert(
      'Ten territory jest edytowany.'
    )

    return
  }

  socket.emit(
    'request-lock',
    id
  )

  sidebar.classList.add(
    'active'
  )

  const data =
    layer.territoryData

  setAccent(
    data.color
  )

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
// LOGO RENDER
// ======================

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
// GALLERY
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
    (img,index) => {

      const div =
        document
          .createElement(
            'div'
          )

      div.className =
        'gallery-item'

      div.innerHTML = `
        <img
          src="${img}"
          onclick="openImage('${img}')"
        />

        <button
          class="remove-image"
          onclick="removeImage(${index})"
        >
          X
        </button>
      `

      gallery.appendChild(
        div
      )
    }
  )
}

// ======================
// IMAGE MODAL
// ======================

function openImage(src) {

  document
    .getElementById(
      'imageModal'
    )
    .style
    .display =
      'flex'

  document
    .getElementById(
      'modalImage'
    )
    .src =
      src
}

document
  .getElementById(
    'closeModal'
  )
  .onclick = () => {

    document
      .getElementById(
        'imageModal'
      )
      .style
      .display =
        'none'
  }

// ======================
// REMOVE IMAGE
// ======================

function removeImage(
  index
) {

  if (
    !selectedLayer
  ) return

  selectedLayer
    .territoryData
    .images
    .splice(index,1)

  renderGallery(
    selectedLayer
      .territoryData
      .images
  )

  saveData()
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

    saveData()
  }
)

// ======================
// CREATE MARKER
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

  marker.description =
    description || ''

  marker.bindTooltip(

    description || 'POINT',

    {
      permanent:true,
      direction:'top',
      offset:[0,-12],
      className:
        'marker-label'
    }
  )

  marker.on(
    'click',
    () => {

      const newName =
        prompt(
          'Nazwa punktu:',
          marker.description
        )

      if (
        newName !== null
      ) {

        marker.description =
          newName

        marker.setTooltipContent(
          newName
        )

        saveData()
      }
    }
  )

  marker.on(
    'contextmenu',
    () => {

      if (
        confirm(
          'Usunąć punkt?'
        )
      ) {

        markersLayer
          .removeLayer(
            marker
          )

        saveData()
      }
    }
  )

  marker.addTo(
    markersLayer
  )
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

      if (
        e.originalEvent
          .target
          .classList
          .contains(
            'leaflet-interactive'
          )
      ) return

      const pointName =
        prompt(
          'Nazwa punktu:'
        )

      if (
        !pointName
      ) return

      const color =
        document
          .getElementById(
            'colorInput'
          )
          .value
          ||
          '#d4af37'

      createMarker(
        e.latlng,
        color,
        pointName
      )

      saveData()
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


 document.getElementById(
  'nameInput'
).oninput = (e) => {

  if (!selectedLayer)
    return

  selectedLayer
    .territoryData
    .name =
      e.target.value

  document.getElementById(
    'territoryTitle'
  ).innerText =
    e.target.value

 
}

document
  .getElementById(
    'descInput'
  )
  .oninput = e => {

    if (
      !selectedLayer
    ) return

    selectedLayer
      .territoryData
      .description =
        e.target.value

   
  }

document
  .getElementById(
    'statusInput'
  )
  .onchange = e => {

    if (
      !selectedLayer
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

   
  }

document
  .getElementById(
    'colorInput'
  )
  .oninput = e => {

    if (
      !selectedLayer
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

    setAccent(
      e.target.value
    )

    
  }

// ======================
// IMAGE INPUT
// ======================

document
  .getElementById(
    'imageInput'
  )
  .onchange = e => {

    if (
      !selectedLayer
    ) return

    const files =
      e.target.files

    for (
      let file
      of files
    ) {

      const reader =
        new FileReader()

      reader.onload =
        event => {

          selectedLayer
            .territoryData
            .images
            .push(
              event
                .target
                .result
            )

          renderGallery(
            selectedLayer
              .territoryData
              .images
          )

          saveData()
        }

      reader.readAsDataURL(
        file
      )
    }
  }

// ======================
// LOGO INPUT
// ======================

document
  .getElementById(
    'logoInput'
  )
  .onchange = async e => {

    if (
      !selectedLayer
    ) return

    const file =
      e.target.files[0]

    const formData =
      new FormData()

    formData.append(
      'file',
      file
    )

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

    selectedLayer
      .territoryData
      .logo =
        data.path

    if (
      selectedLayer
        .logoMarker
    ) {

      map.removeLayer(

        selectedLayer
          .logoMarker
      )
    }

    createTerritoryLogo(
      selectedLayer
    )

    renderLogo(
      data.path
    )

    saveData()
  }

// ======================
// DELETE
// ======================

document
  .getElementById(
    'deleteBtn'
  )
  .onclick = () => {

    if (
      !selectedLayer
    ) return

    if (
      selectedLayer
        .logoMarker
    ) {

      map.removeLayer(
        selectedLayer
          .logoMarker
      )
    }

    drawnItems
      .removeLayer(
        selectedLayer
      )

    sidebar
      .classList
      .remove(
        'active'
      )

    saveData()
  }

// ======================
// DUPLICATE
// ======================

document
  .getElementById(
    'duplicateBtn'
  )
  .onclick = () => {

    if (
      !selectedLayer
    ) return

    const clone =
      L.polygon(

        selectedLayer
          .getLatLngs(),

        {
          color:
            selectedLayer
              .territoryData
              .color,

          fillColor:
            selectedLayer
              .territoryData
              .color,

          fillOpacity:.35,

          weight:3
        }
      )

    clone.territoryData =
      JSON.parse(

        JSON.stringify(
          selectedLayer
            .territoryData
        )
      )

    clone.territoryData.id =
      crypto.randomUUID()

    addLayerEvents(
      clone
    )

    drawnItems
      .addLayer(
        clone
      )

    createTerritoryLogo(
      clone
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
  .onclick = async () => {

    await saveData()

    alert(
      'Zapisano.'
    )
  }

// ======================
// CLEAR BTN
// ======================

document
  .getElementById(
    'clearBtn'
  )
  .onclick = async () => {

    if (
      !confirm(
        'Usunąć wszystko?'
      )
    ) return

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
// LIVE UPDATE
// ======================

socket.on(
  'live-update',
  async () => {

    await loadData()
  }
)

// ======================
// LOCKS
// ======================

socket.on(
  'locks-update',
  locks => {

    activeLocks =
      locks

    drawnItems.eachLayer(
      layer => {

        const id =
          layer
            .territoryData
            .id

        if (
          locks[id]
        ) {

          layer.setStyle({
            dashArray:
              '8 8'
          })

        } else {

          layer.setStyle({
            dashArray:
              null
          })
        }
      }
    )
  }
)

// ======================
// START
// ======================

loadData()