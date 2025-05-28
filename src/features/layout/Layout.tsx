import MainNav from "./components/MainNav"

const Layout = ({ children }) => {
  return (
    <div className="Container">
      <MainNav />
      <div className="Content">
        {children}
      </div>
    </div>
  )
}

export default Layout