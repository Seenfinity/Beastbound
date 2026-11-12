// Momentos de crianza: situaciones cortas con dos respuestas.
// Cada respuesta empuja el carácter (cariño, disciplina, bravura) y toca ánimo, vínculo, etc.
// {n} se sustituye por el nombre de la criatura.

export const EVENTS = [
  { id: 'llanto', text: '{n} ha encontrado a un bicho más pequeño llorando.',
    choices: [
      { label: 'Que lo consuele', result: '{n} se queda a su lado hasta que se calma.', fx: { carino: 2, bond: 2 } },
      { label: 'Que le enseñe a defenderse', result: '{n} le enseña a gruñir. Los dos salen más duros.', fx: { bravura: 2 } },
    ] },
  { id: 'jarron', text: '{n} ha roto un jarrón jugando.',
    choices: [
      { label: 'Regañarle', result: '{n} agacha las orejas. No lo volverá a hacer.', fx: { disciplina: 2, mood: -8 } },
      { label: 'Reírte con él', result: 'Os reís los dos. El jarrón era feo.', fx: { carino: 2, mood: 8 } },
    ] },
  { id: 'burla', text: 'Un rival enorme se burla de {n} desde lejos.',
    choices: [
      { label: 'Plantarle cara', result: '{n} le ruge de vuelta. El grandullón se calla.', fx: { bravura: 3, energy: -10 } },
      { label: 'Ignorarlo', result: '{n} respira hondo y sigue a lo suyo.', fx: { disciplina: 1, mood: 3 } },
    ] },
  { id: 'pereza', text: '{n} no quiere entrenar hoy.',
    choices: [
      { label: 'Insistir', result: 'Entrena a regañadientes, pero entrena.', fx: { disciplina: 2, mood: -6, exp: 6 } },
      { label: 'Día libre', result: 'Pasáis la tarde tirados en la hierba.', fx: { carino: 2, mood: 10 } },
    ] },
  { id: 'tormenta', text: 'Hay tormenta y {n} está temblando.',
    choices: [
      { label: 'Abrazarlo', result: '{n} se duerme pegado a ti.', fx: { carino: 3, bond: 3 } },
      { label: 'Que aprenda a aguantar', result: '{n} aguanta el miedo solo. Te mira raro.', fx: { bravura: 2, bond: -1 } },
    ] },
  { id: 'regalo', text: '{n} te trae un regalo: una piedra que brilla.',
    choices: [
      { label: 'Guardarla', result: 'La pones en tu bolsillo. {n} no cabe en sí.', fx: { bond: 3, carino: 1 } },
      { label: 'Venderla', result: 'Te dan 12 monedas. {n} lo ha visto todo.', fx: { coins: 12, bond: -2 } },
    ] },
  { id: 'desvelo', text: '{n} quiere quedarse despierto hasta tarde.',
    choices: [
      { label: 'Dejarle', result: 'Noche de juegos. Mañana estará molido.', fx: { mood: 8, energy: -15, carino: 1 } },
      { label: 'A dormir', result: 'Protesta, pero se duerme en dos minutos.', fx: { disciplina: 2, energy: 15 } },
    ] },
  { id: 'basura', text: '{n} ha encontrado comida en la basura.',
    choices: [
      { label: 'Dejar que coma', result: 'Se la zampa. Mejor no saber qué era.', fx: { hunger: 25, descuido: 1.5 } },
      { label: 'Quitársela y darle algo bueno', result: 'Le cambias la basura por un bocado decente.', fx: { coins: -3, carino: 1, hunger: 12 } },
    ] },
];
