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

        try {
            // Ensure we have a cart token; request one if missing
            let cartToken = localStorage.getItem("cart_token")
            if (!cartToken) {
                const tokenRes = await api.post("cart/token/", {})
                if (tokenRes?.data?.cart_token) {
                    cartToken = tokenRes.data.cart_token
                    localStorage.setItem("cart_token", cartToken)
                    localStorage.removeItem("cart_code")
                }
            }

            const res = await api.get("get_username")
            setUsername(res.data.username)
            setIsStaff(res.data.is_staff || false)
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