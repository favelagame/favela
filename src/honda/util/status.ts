const $ = document.querySelector.bind(document);
const statusEl = $<HTMLPreElement>("#status")!;
const errorEl = $<HTMLPreElement>("#error")!;

export function setStatus(status: string | undefined) {
    if (status) {
        statusEl.innerText = status;
        statusEl.classList.remove("hide");
    } else {
        statusEl.classList.add("hide");
    }
}

export function setError(error: string | undefined) {
    if (error) {
        errorEl.innerText = error;
        errorEl.classList.remove("hide");
        setStatus('errored');
    } else {
        errorEl.classList.add("hide");
    }
}
