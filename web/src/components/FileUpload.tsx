import { Camera, Paperclip, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../lib/api";

export type Finalidade =
  "comprovante_pagamento" | "comprovante_despesa" | "logo";

const TAMANHO_MAXIMO = 5 * 1024 * 1024;

function mensagemErro(err: any) {
  return (
    err?.response?.data?.error?.message ?? "Não foi possível enviar o arquivo."
  );
}

/**
 * Abre o arquivo numa aba nova via URL assinada (10 min). A aba é aberta antes
 * do await pra não ser barrada pelo bloqueador de pop-up.
 */
export async function abrirArquivo(referencia: string) {
  const aba = window.open("", "_blank");
  try {
    const { data } = await api.get("/uploads/signed-url", {
      params: { path: referencia },
    });
    if (aba) aba.location.href = data.url;
    else window.location.href = data.url;
  } catch (err) {
    aba?.close();
    window.alert(mensagemErro(err));
  }
}

async function enviar(
  finalidade: Finalidade,
  entidadeId: string | undefined,
  arquivo: File,
  onProgresso: (p: number) => void,
) {
  const form = new FormData();
  form.append("finalidade", finalidade);
  if (entidadeId) form.append("entidadeId", entidadeId);
  form.append("arquivo", arquivo);
  const { data } = await api.post("/uploads", form, {
    onUploadProgress: (e) =>
      e.total && onProgresso(Math.round((e.loaded / e.total) * 100)),
  });
  return data.referencia as string;
}

const LADO_MAXIMO = 2000;
const COMPRIMIR_ACIMA_DE = 1.5 * 1024 * 1024;

function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("imagem ilegível"));
    };
    img.src = url;
  });
}

/**
 * Foto do celular vem grande (4–12 MB) e às vezes em HEIC: redimensiona para
 * no máximo 2000 px e regrava em JPEG antes de enviar. Regravar também descarta
 * os metadados EXIF (inclusive a localização GPS da foto).
 */
export async function prepararImagem(arquivo: File): Promise<File> {
  const ehImagem =
    arquivo.type.startsWith("image/") || /\.(heic|heif)$/i.test(arquivo.name);
  const formatoAceito = ["image/jpeg", "image/png", "image/webp"].includes(
    arquivo.type,
  );
  if (!ehImagem || (formatoAceito && arquivo.size <= COMPRIMIR_ACIMA_DE))
    return arquivo;
  try {
    const img = await carregarImagem(arquivo);
    const escala = Math.min(
      1,
      LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return arquivo;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/jpeg", 0.82),
    );
    if (!blob) return arquivo;
    const nome = arquivo.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${nome}.jpg`, { type: "image/jpeg" });
  } catch {
    return arquivo;
  }
}

function validarLocal(arquivo: File, aceitaPdf: boolean) {
  const tipos = [
    "image/jpeg",
    "image/png",
    "image/webp",
    ...(aceitaPdf ? ["application/pdf"] : []),
  ];
  if (!tipos.includes(arquivo.type))
    return aceitaPdf ? "Envie JPG, PNG, WEBP ou PDF" : "Envie JPG, PNG ou WEBP";
  if (arquivo.size > TAMANHO_MAXIMO) return "Arquivo maior que 5 MB";
  return "";
}

interface Props {
  finalidade: Finalidade;
  entidadeId?: string;
  aceitaPdf?: boolean;
  onEnviado: (referencia: string) => void;
  /** Texto da área de soltar. */
  rotulo?: string;
}

/** Área de arrastar-e-soltar + clique, com prévia de imagem, progresso e erro. */
export function FileUpload({
  finalidade,
  entidadeId,
  aceitaPdf = true,
  onEnviado,
  rotulo,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [progresso, setProgresso] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  const processar = async (original: File | undefined) => {
    if (!original) return;
    setErro("");
    const arquivo = await prepararImagem(original);
    const invalido = validarLocal(arquivo, aceitaPdf);
    if (invalido) return setErro(invalido);
    setPreview(
      arquivo.type.startsWith("image/") ? URL.createObjectURL(arquivo) : null,
    );
    setProgresso(0);
    try {
      onEnviado(await enviar(finalidade, entidadeId, arquivo, setProgresso));
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setProgresso(null);
      if (input.current) input.current.value = "";
      if (camera.current) camera.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {finalidade !== "logo" && (
        <button
          type="button"
          disabled={progresso != null}
          onClick={() => camera.current?.click()}
          className="md:hidden w-full h-11 inline-flex items-center justify-center gap-2 rounded-md bg-brand text-white text-sm font-semibold disabled:opacity-50"
        >
          <Camera size={16} /> Tirar foto do comprovante
        </button>
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          processar(e.dataTransfer.files[0]);
        }}
        className={`flex items-center gap-3 border-2 border-dashed rounded-lg px-4 py-3 cursor-pointer transition-colors ${
          arrastando
            ? "border-brand bg-brand-soft"
            : "border-stone-300 hover:border-brand"
        }`}
      >
        {preview ? (
          <img
            src={preview}
            alt=""
            className="h-10 w-10 object-cover rounded"
          />
        ) : (
          <Upload size={18} className="text-zinc-400" />
        )}
        <div className="text-xs text-zinc-500 flex-1">
          {progresso != null ? (
            <>
              Enviando… {progresso}%
              <div className="h-1 bg-stone-200 rounded mt-1 overflow-hidden">
                <div
                  className="h-full bg-brand"
                  style={{ width: `${progresso}%` }}
                />
              </div>
            </>
          ) : (
            (rotulo ??
              (window.matchMedia("(pointer: coarse)").matches
                ? "Toque para escolher um arquivo"
                : "Arraste o arquivo ou clique para escolher")) +
            (aceitaPdf
              ? " (JPG, PNG, WEBP ou PDF, até 5 MB)"
              : " (JPG, PNG ou WEBP, até 5 MB)")
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept={aceitaPdf ? "image/*,application/pdf" : "image/*"}
        onChange={(e) => processar(e.target.files?.[0])}
      />
      <input
        ref={camera}
        type="file"
        hidden
        accept="image/*"
        capture="environment"
        onChange={(e) => processar(e.target.files?.[0])}
      />
      {erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
    </div>
  );
}

/**
 * Versão compacta pras linhas de pagamento/despesa: clipe pra ver, botão pra
 * anexar/substituir e X pra remover.
 */
export function ComprovanteInline({
  finalidade,
  entidadeId,
  referencia,
  podeEditar,
  onAlterado,
}: {
  finalidade: "comprovante_pagamento" | "comprovante_despesa";
  entidadeId: string;
  referencia: string | null;
  podeEditar: boolean;
  onAlterado: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  const escolher = async (original: File | undefined) => {
    if (!original) return;
    const arquivo = await prepararImagem(original);
    const invalido = validarLocal(arquivo, true);
    if (invalido) return window.alert(invalido);
    setEnviando(true);
    try {
      await enviar(finalidade, entidadeId, arquivo, () => undefined);
      onAlterado();
    } catch (err) {
      window.alert(mensagemErro(err));
    } finally {
      setEnviando(false);
      if (input.current) input.current.value = "";
    }
  };

  const remover = async () => {
    if (!window.confirm("Remover o comprovante anexado?")) return;
    await api.delete("/uploads", { data: { finalidade, entidadeId } });
    onAlterado();
  };

  return (
    <span className="inline-flex items-center gap-1">
      {referencia ? (
        <button
          type="button"
          onClick={() => abrirArquivo(referencia)}
          title="Ver comprovante"
          className="text-emerald-700 hover:text-emerald-900"
        >
          <Paperclip size={14} />
        </button>
      ) : null}
      {podeEditar && (
        <button
          type="button"
          disabled={enviando}
          onClick={() => input.current?.click()}
          title={referencia ? "Substituir comprovante" : "Anexar comprovante"}
          className="text-zinc-400 hover:text-zinc-900 disabled:opacity-50 text-[11px] font-semibold"
        >
          {enviando ? "…" : referencia ? "trocar" : <Upload size={14} />}
        </button>
      )}
      {podeEditar && referencia && (
        <button
          type="button"
          onClick={remover}
          title="Remover comprovante"
          className="text-zinc-400 hover:text-red-600"
        >
          <X size={12} />
        </button>
      )}
      <input
        ref={input}
        type="file"
        hidden
        accept="image/*,application/pdf"
        onChange={(e) => escolher(e.target.files?.[0])}
      />
    </span>
  );
}
