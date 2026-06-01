import { useMemo, useRef, useState } from "react";
import { navItems } from "../../data/homeData";
import { CartIcon, ChevronDownIcon, LogOutIcon, MapPinIcon, SearchIcon, SparkIcon, StoreIcon, UserIcon } from "../ui/Icons";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useOutsideClick } from "../../hooks/useOutsideClick";

export default function MainHeader({ isAuthenticated, user, onLoginClick, onRegisterClick, onLogoutClick, onProfileClick, onCartClick, onOpinionClick }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  useOutsideClick(userMenuRef, () => setShowUserMenu(false));;

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  const accountLabel = fullName || user?.username || "Mi cuenta";

  const initials = useMemo(() => {
    if (fullName) {
      const parts = fullName.split(" ").filter(Boolean);
      const first = parts[0]?.[0] || "";
      const second = parts[1]?.[0] || "";
      return `${first}${second}`.toUpperCase() || "US";
    }

    const value = user?.username || "Usuario";
    return value.slice(0, 2).toUpperCase();
  }, [fullName, user]);

  return (
    <header className="rounded-[28px] border border-sky-100/80 bg-white/97 p-4 shadow-2xl shadow-slate-200/60 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white">
            <StoreIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-700">Farmacia SaludPlus</p>
            <h1 className="text-lg font-black text-slate-900 sm:text-xl">Tu salud en buenas manos</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" className="border-teal-200 bg-teal-50 text-teal-800 hover:border-teal-300 hover:bg-teal-100">
            <MapPinIcon className="h-4 w-4" />
            Sucursales
          </Button>
          {isAuthenticated && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpinionClick}
              className="border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100"
            >
              <SparkIcon className="h-4 w-4" />
              Opinar
            </Button>
          )}
          {isAuthenticated ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setShowUserMenu((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-xl border border-teal-200 bg-white px-3 py-2 text-xs font-bold text-teal-700"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-teal-600 to-cyan-600 text-[10px] font-black text-white">
                  {initials}
                </span>
                <span>{accountLabel}</span>
                <ChevronDownIcon className={`h-4 w-4 transition ${showUserMenu ? "rotate-180" : ""}`} />
              </button>

              {showUserMenu ? (
                <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-bold text-slate-800">{accountLabel}</p>
                    <p className="text-[11px] text-slate-500">{user?.email || "Sin correo"}</p>
                  </div>
                  <div className="p-1.5">
                    <button
                      type="button"
                      onClick={onProfileClick}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      <UserIcon className="h-4 w-4" />
                      Mi perfil
                    </button>
                    <button
                      type="button"
                      onClick={onLogoutClick}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      <LogOutIcon className="h-4 w-4" />
                      Cerrar sesion
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={onLoginClick}
                className="border-teal-200 text-teal-700 hover:bg-teal-50"
              >
                Iniciar sesion
              </Button>
              <Button
                size="sm"
                onClick={onRegisterClick}
                className="bg-teal-700 hover:bg-teal-600"
              >
                Registrarse
              </Button>
            </>
          )}
          <Button size="sm" className="gap-1 bg-teal-700 hover:bg-teal-600" onClick={onCartClick}>
            <CartIcon className="h-4 w-4" />
            Ver carrito
          </Button>
        </div>
      </div>
      
    </header>
  );
}
