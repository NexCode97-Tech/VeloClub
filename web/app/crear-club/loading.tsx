import LoadingScreen from '@/components/ui/loading-screen';

// Next muestra esto apenas se toca el enlace, sin esperar a que baje el codigo
// de la pagina. Es lo que hace que el boton del hero responda de inmediato en
// vez de dejar al usuario mirando la pantalla anterior sin señal de que algo
// esta pasando.
export default function Loading() {
  return <LoadingScreen />;
}
