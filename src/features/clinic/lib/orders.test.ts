import { describe, expect, it } from "vitest";
import { ORDER_KINDS, isOrderKind, orderMessage, orderNumber } from "@/features/clinic/lib/orders";

describe("órdenes", () => {
  it("numbers órdenes like ORD-00000003", () => {
    expect(orderNumber(3)).toBe("ORD-00000003");
  });

  it("knows its three kinds, each with things to ask for", () => {
    expect(Object.keys(ORDER_KINDS)).toEqual(["imagenes", "laboratorio", "derivacion"]);
    expect(isOrderKind("laboratorio")).toBe(true);
    expect(isOrderKind("receta")).toBe(false);
    for (const kind of Object.values(ORDER_KINDS)) expect(kind.options.length).toBeGreaterThan(2);
    expect(ORDER_KINDS.laboratorio.options).toContain("Coagulograma (TP, KPTT, RIN)");
  });

  it("writes the WhatsApp text with what's asked and why", () => {
    expect(
      orderMessage({
        patientName: "Leonardo Aguirre",
        clinicName: "Clínica Capeans",
        kind: "imagenes",
        items: ["Radiografía panorámica", "Radiografía periapical de la pieza 16"],
        diagnosis: "Evaluación de terceros molares",
      }),
    ).toBe(
      "Hola Leonardo, te paso la orden de Clínica Capeans (Estudios por imágenes):\n\n" +
        "• Radiografía panorámica\n• Radiografía periapical de la pieza 16\n\n" +
        "Diagnóstico: Evaluación de terceros molares",
    );
  });
});
