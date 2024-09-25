document.addEventListener("DOMContentLoaded", async () => {
    /*
        Tomar una fotografía e imprimirla en una impresora térmica
        @date 2024-09-20
        @author parzibyte
        @web parzibyte.me/blog
    */
    const tieneSoporteUserMedia = () =>
        !!(navigator.getUserMedia || (navigator.mozGetUserMedia || navigator.mediaDevices.getUserMedia) || navigator.webkitGetUserMedia || navigator.msGetUserMedia)
    const _getUserMedia = (...arguments) =>
        (navigator.getUserMedia || (navigator.mozGetUserMedia || navigator.mediaDevices.getUserMedia) || navigator.webkitGetUserMedia || navigator.msGetUserMedia).apply(navigator, arguments);

    const $video = document.querySelector("#video"),
        $estado = document.querySelector("#estado"),
        $listaDeDispositivos = document.querySelector("#listaDeDispositivos"),
        $impresoras = document.querySelector("#impresoras"),
        $imprimir = document.querySelector("#imprimir"),
        $algoritmo = document.querySelector("#algoritmo"),
        $licencia = document.querySelector("#licencia");
    let stream;
    let canvasFueraDePantalla = null;
    let contextoCanvas = null;

    const limpiarSelect = (elementoSelect) => {
        for (let x = elementoSelect.options.length - 1; x >= 0; x--)
            elementoSelect.remove(x);
    };
    // La función que es llamada después de que ya se dieron los permisos
    // Lo que hace es llenar el select con los dispositivos obtenidos
    const llenarSelectConDispositivosDisponibles = async (elementoSelect) => {
        limpiarSelect(elementoSelect);
        const dispositivos = await navigator.mediaDevices.enumerateDevices();
        const dispositivosDeVideo = [];
        dispositivos.forEach(dispositivo => {
            const tipo = dispositivo.kind;
            if (tipo === "videoinput") {
                dispositivosDeVideo.push(dispositivo);
            }
        });
        for (const dispositivo of dispositivosDeVideo) {
            const option = Object.assign(document.createElement("option"), {
                value: dispositivo.deviceId,
                text: dispositivo.label,
            });
            elementoSelect.appendChild(option);
        }
    }

    const imprimirFoto = async (nombreImpresora, fotoEnBase64, algoritmo, licencia) => {
        const payload = {
            "serial": licencia,
            "nombreImpresora": nombreImpresora,
            "operaciones": [
                {
                    "nombre": "ImprimirImagenEnBase64",
                    "argumentos": [
                        fotoEnBase64,
                        380,
                        algoritmo,
                        true
                    ]
                },
            ]
        };
        const httpResponse = await fetch("http://localhost:8000/imprimir",
            {
                method: "POST",
                body: JSON.stringify(payload),
            });

        const jsonResponse = await httpResponse.json();
        if (jsonResponse.ok) {
            // Everything is ok
            console.log("Printed successfully");
        } else {
            // Error message is on message property
            console.error(jsonResponse.message)
        }
    }

    const tomarFoto = async () => {
        //Pausar reproducción
        $video.pause();
        canvasFueraDePantalla.width = $video.videoWidth;
        canvasFueraDePantalla.height = $video.videoHeight;
        //Obtener contexto del canvas y dibujar sobre él
        contextoCanvas.drawImage($video, 0, 0, canvasFueraDePantalla.width, canvasFueraDePantalla.height);
        //Reanudar reproducción
        await $video.play();
        const blob = await canvasFueraDePantalla.convertToBlob();
        const reader = new FileReader();
        reader.onloadend = async () => {
            await imprimirFoto($impresoras.value, reader.result, parseInt($algoritmo.value), $licencia.value);
        }
        reader.onerror = () => { }
        reader.readAsDataURL(blob);
    }
    const obtenerImpresoras = async () => {
        const respuesta = await fetch("http://localhost:8000/impresoras");
        const impresoras = await respuesta.json();
        for (const impresora of impresoras) {
            const option = Object.assign(document.createElement("option"), {
                value: impresora,
                text: impresora,
            })
            $impresoras.appendChild(option);
        }
    }

    async function iniciarStream() {
        // Comenzamos viendo si tiene soporte, si no, nos detenemos
        if (!tieneSoporteUserMedia()) {
            alert("Lo siento. Tu navegador no soporta esta característica");
            $estado.innerHTML = "Parece que tu navegador no soporta esta característica. Intenta actualizarlo.";
            return;
        }
        const mostrarStream = idDeDispositivo => {
            _getUserMedia({
                video: {
                    // Justo aquí indicamos cuál dispositivo usar
                    deviceId: idDeDispositivo,
                }
            },
                async (streamObtenido) => {
                    // Aquí ya tenemos permisos, ahora sí llenamos el select,
                    // pues si no, no nos daría el nombre de los dispositivos
                    if ($listaDeDispositivos.length <= 0) {
                        llenarSelectConDispositivosDisponibles($listaDeDispositivos);
                    }

                    // Escuchar cuando seleccionen otra opción y entonces llamar a esta función
                    $listaDeDispositivos.onchange = () => {
                        // Detener el stream
                        if (stream) {
                            stream.getTracks().forEach(function (track) {
                                track.stop();
                            });
                        }
                        // Mostrar el nuevo stream con el dispositivo seleccionado
                        mostrarStream($listaDeDispositivos.value);
                    }

                    // Simple asignación
                    stream = streamObtenido;

                    // Mandamos el stream de la cámara al elemento de vídeo
                    $video.srcObject = stream;
                    // Refrescar el canvas
                    await $video.play();
                    canvasFueraDePantalla = new OffscreenCanvas($video.videoWidth, $video.videoHeight);
                    contextoCanvas = canvasFueraDePantalla.getContext("2d");

                }, (error) => {
                    console.log("Permiso denegado o error: ", error);
                    $estado.innerHTML = "No se puede acceder a la cámara, o no diste permiso.";
                });
        }

        // Comenzamos pidiendo los dispositivos
        const dispositivos = await navigator.mediaDevices.enumerateDevices();
        // Vamos a filtrarlos y guardar aquí los de vídeo
        const dispositivosDeVideo = [];

        // Recorrer y filtrar
        dispositivos.forEach(function (dispositivo) {
            const tipo = dispositivo.kind;
            if (tipo === "videoinput") {
                dispositivosDeVideo.push(dispositivo);
            }
        });

        // Vemos si encontramos algún dispositivo, y en caso de que si, entonces llamamos a la función
        // y le pasamos el id de dispositivo
        if (dispositivosDeVideo.length > 0) {
            // Mostrar stream con el ID del primer dispositivo, luego el usuario puede cambiar
            mostrarStream(dispositivosDeVideo[0].deviceId);
        }
    }
    await obtenerImpresoras();
    await iniciarStream();
    $imprimir.addEventListener("click", async () => {
        await tomarFoto();
    });
});