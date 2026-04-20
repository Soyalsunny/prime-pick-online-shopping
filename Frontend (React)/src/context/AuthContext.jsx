import { jwtDecode } from "jwt-decode";
import { createContext, useEffect, useState } from "react";
import api from "../api";

export const AuthContext = createContext(false)

export function AuthProvider({children}){

    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [username, setUsername] = useState("")
    const [isStaff, setIsStaff] = useState(false)

    const handleAuth = () => {
        const token = localStorage.getItem("access")
        if(token) {
            const decoded = jwtDecode(token)
            const expiry_date = decoded.exp
            const current_time = Date.now() / 1000
            if(expiry_date >= current_time){
                setIsAuthenticated(true)
                return
            }
        }

        setIsAuthenticated(false)
        setUsername("")
        setIsStaff(false)
    }


    async function get_username(){
        const token = localStorage.getItem("access")
        if(!token){
            setUsername("")
            setIsStaff(false)
            return null
        }

        const guestCartCode = localStorage.getItem("cart_code")

        try {
            const query = guestCartCode
                ? `get_username?guest_cart_code=${encodeURIComponent(guestCartCode)}`
                : "get_username"
            const res = await api.get(query)
            setUsername(res.data.username)
            setIsStaff(res.data.is_staff || false)
            if (res.data.cart_code) {
                localStorage.setItem("cart_code", res.data.cart_code)
            }
            return res.data
        } catch (err) {
            console.log(err.message)
            setUsername("")
            setIsStaff(false)
            return null
        }
    }

    useEffect(function(){
        handleAuth()
        get_username()
    }, [])

    const authValue = {isAuthenticated, username, isStaff, setIsAuthenticated, get_username}

    return <AuthContext.Provider value={authValue}>
        {children}
    </AuthContext.Provider>
}