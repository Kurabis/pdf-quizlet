import * as pdfjsLib from "/pdfjs/pdf.mjs";

const { PDFDocument } = PDFLib;

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.mjs";

let fileInput, fileButton, pageDeny, pageDisplay, pageAccept;
let pageStates, pagesRemaining, pdfDoc, pageIndex = 0, pageRef, viewport, canvas, context, revealed;

const original = {};

$(document).ready(function() {
    fileInput = $("#file-input");
    fileButton = $("#file-button");
    pageDeny = $("#page-deny");
    pageDisplay = $("#page-display");
    pageAccept = $("#page-accept");

    fileButton.on("click", function() {
        loadInput();
    });

    pageDeny.on("click", function() {
        denyPage();
    });

    pageDisplay.on("click", function() {
        showText();
    });

    pageAccept.on("click", function() {
        acceptPage();
    });
});

$(document).on("keydown", function(e) {
    if (e.keyCode === 37 || e.keyCode === 49) {
        denyPage();
        e.preventDefault();
    } else if (e.keyCode === 32 || e.keyCode === 40) {
        revealed = true;

        showText();
        e.preventDefault();
    } else if (e.keyCode === 39 || e.keyCode === 50) {
        acceptPage();
        e.preventDefault();
    }
});

async function loadInput() {
    const files = Array.from(fileInput[0].files);
    const mergedPdf = await PDFDocument.create();

    let allPages = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

        // Collect all pages into one array
        allPages.push(...copiedPages);
    }

    // Shuffle the pages array
    for (let i = allPages.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allPages[i], allPages[j]] = [allPages[j], allPages[i]];
    }

    // Add shuffled pages to the merged PDF
    allPages.forEach((page) => mergedPdf.addPage(page));

    const mergedPdfBytes = await mergedPdf.save();

    // Create a Blob URL and display in iframe
    const blob = new Blob([mergedPdfBytes], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);

    pageStates = new Array(mergedPdf.getPageCount()).fill(false);

    pagesRemaining = pageStates.length;

    pdfjsLib.getDocument(blobUrl).promise.then(pdf => {
        pdfDoc = pdf;

        checkRemainingPages();
    }).catch(console.error);
}

function checkRemainingPages() {
    if (pagesRemaining > 0) {
        generateRandomIndex();
        displayPage();
    } else {
        alert("No pages to display.");
    }
}

function generateRandomIndex() {
    /*let previousIndex = pageIndex;

    do {
        pageIndex = Math.floor(Math.random() * pageStates.length);

        if (pageIndex === previousIndex) continue;
    } while (pageStates[pageIndex] === true);*/

    do {
        if (pageIndex < pageStates.length - 1) {
            pageIndex++;
        } else {
            pageIndex = 0; // Reset to start if at the end
        }
    } while (pageStates[pageIndex] == true);

    console.log(pageIndex);
}

function displayPage() {
    pdfDoc.getPage(pageIndex + 1).then(page => {
        pageRef = page;

        const scale = 1.5;
        viewport = page.getViewport({ scale });

        canvas = $("#pdf-canvas")[0];
        context = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const methodsToOverride = [
            "fillText", "strokeText", "fillRect", "strokeRect",
            "stroke", "fill", "beginPath", "moveTo", "lineTo",
            "bezierCurveTo", "quadraticCurveTo", "arc", "arcTo",
            "rect", "closePath"
        ];

        methodsToOverride.forEach(method => {
            original[method] = context[method];
            context[method] = () => {};
        });

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        revealed = false;

        page.render(renderContext).promise.then(() => {
            console.log("Page rendered with all text-related visuals suppressed.");
        });
    }).catch(console.error);
}

function denyPage() {
    if (!revealed) showText();
    checkRemainingPages();
}

function showText() {
    if (!pageRef || !context || !viewport) return;

    // Restore original canvas methods
    Object.assign(context, original);

    // Optional: clear the canvas before re-rendering
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (revealed) {
        // Re-render with all visuals
        pageRef.render({
            canvasContext: context,
            viewport: viewport
        }).promise.then(() => {
            console.log("Re-rendered with text and visuals.");
        });
    }
}

function acceptPage() {
    pageStates[pageIndex] = true;
    pagesRemaining--;

    if (!revealed) showText();
    checkRemainingPages();
}
