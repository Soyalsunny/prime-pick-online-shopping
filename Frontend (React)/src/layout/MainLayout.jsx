import NavBar from '../components/ui/NavBar'
import Footer from '../components/ui/Footer'
import { Outlet } from 'react-router-dom'

const MainLayout = ({numCartItems, setNumCartItems}) => {
  return (
    <>
    <NavBar numCartItems={numCartItems} setNumCartItems={setNumCartItems} />
    <Outlet />
    <Footer />
    </>
  )
}

export default MainLayout
