"use client";
import { ImageSlider, Model, NotFound, SearchBar } from "@/components/";
import { Cart, BasketBar, Footer, Loading, PageNotFound, NavBar, NightFoodCart, NightFoodBanner } from "@/components/core"; //Sok Thean Night Food
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import OrderItem from "@/components/OrderItem";
import { Provider } from "react-redux";
import store from "@/lib/store";
import { Menu, MenuType } from "@/types/model";
import { useParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import {
  fetchMenuProducts,
  fetchSetting,
  getCachedMenuProducts,
  getCachedSetting,
} from "@/lib/apiCache";

// Special category names for custom UI rendering
const NIGHT_FOOD_CATEGORY = "ម្ហូបយប់"; //Sok Thean
const RIVER_SNACK_CATEGORY = "គ្រឿងក្លែមទន្លេ"; //Sok Thean

export default function Home() {

  const { projectName, tableNumber } = useParams();
  const { t } = useTranslation();

  const cachedMenu = useMemo(() => getCachedMenuProducts(), []);
  const cachedSetting = useMemo(() => getCachedSetting(), []);

  const [loading, setLoading] = useState(!cachedMenu); // Instant if prefetched/cached
  const [historyOrder, setHistoryOrder] = useState<any>(null);
  const [isClickOrder, setClickOrder] = useState(false);

  // Fetch history order details (suspend order) on component mount and when an order is placed
  useEffect(() => {
    if (!projectName || !tableNumber) return;
    let isMounted = true;
    const fetchHistoryOrder = async () => {
      try {
        const formData = new FormData();
        formData.append("table_num", `${tableNumber}`);
        const response = await axios.post(
          `https://pos-jouboun.tsdsolution.net/api/DriverController/orders`,
          formData
        );
        if (isMounted) {
          setHistoryOrder(response.data);
        }
      } catch (error) {
        console.error("Error fetching history order:", error);
      }
    };
    fetchHistoryOrder();
    return () => {
      isMounted = false;
    };
  }, [projectName, tableNumber, isClickOrder]);

  //Sok Thean Subcategory
  const [activeSection, setActiveSection] = useState<number>(0); // State to track active section
  const [activeSubSection, setActiveSubSection] = useState<string>(""); // State to track active sub-section
  const ref = useRef<(HTMLDivElement | null)[]>([]); // Ref to store section elements
  const subRef = useRef<Record<string, HTMLDivElement | null>>({}); // Ref to store sub-section elements
  //End ST Subcategory
  const [searchQuery, setSearchQuery] = useState(""); // State for search query
  const [data, setData] = useState<MenuType>(cachedMenu || []); // State for fetched data
  const isOrderPage = true; // Flag for order page
  const [images, setImages] = useState<any[]>(cachedSetting?.slides || []);
  const [isNotFound, setNotFound] = useState(false);
  const [cur, setCur] = useState<any>(cachedSetting?.symbol ?? null);

  // Progressive rendering: render first 2 categories on frame 1 for instant paint, then unlock all on next frame
  const [renderAllCategories, setRenderAllCategories] = useState(false);

  const imgUrl = `https://pos-jouboun.tsdsolution.net/assets/uploads/`;

  // Fetch data on component mount (deduplicated & cached)
  useEffect(() => {
    let isMounted = true;

    fetchSetting().then((setting) => {
      if (!isMounted || !setting) return;
      setImages(setting.slides);
      setCur(setting.symbol);
    });

    fetchMenuProducts()
      .then((dataJson) => {
        if (!isMounted) return;
        setData(dataJson);
        if (dataJson.length === 0) {
          setNotFound(true);
        }
        setLoading(false);
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error("Error fetching data:", error);
        if (!cachedMenu) {
          setNotFound(true);
        }
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [projectName, cachedMenu]);

  useEffect(() => {
    if (!loading && data.length > 0 && !renderAllCategories) {
      const id = requestAnimationFrame(() => {
        setRenderAllCategories(true);
      });
      return () => cancelAnimationFrame(id);
    }
  }, [loading, data.length, renderAllCategories]);

  // Pre-compute filtered & subcategory-grouped menu in a single pass
  const groupedMenu = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data
      .map((category) => {
        const items = q
          ? category.items.filter((item) => item.name.toLowerCase().includes(q))
          : category.items;

        if (items.length === 0) return null;

        const isListStyle =
          category.category === NIGHT_FOOD_CATEGORY ||
          category.category === RIVER_SNACK_CATEGORY;

        // Group items by subcategory in a single O(N) pass
        const subMap = new Map<string, Menu[]>();
        const bannerImagesSet = new Set<string>();

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const sub = item.subcategory && item.subcategory.trim() !== "" ? item.subcategory.trim() : "ផ្សេងៗ";
          let group = subMap.get(sub);
          if (!group) {
            group = [];
            subMap.set(sub, group);
          }
          group.push(item);

          if (isListStyle && item.imagePath && item.imagePath.trim() !== "") {
            bannerImagesSet.add(item.imagePath);
          }
        }

        const subNames = Array.from(subMap.keys()).sort((a, b) =>
          a === "ផ្សេងៗ" ? 1 : b === "ផ្សេងៗ" ? -1 : 0
        );

        const subcategories = subNames.map((subName) => ({
          subName,
          items: subMap.get(subName) || [],
        }));

        return {
          category: category.category,
          items,
          isListStyle,
          bannerImages: isListStyle ? Array.from(bannerImagesSet) : [],
          subcategories,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [data, searchQuery]);

  // Memoize active category's subcategories for the top sub-navigation bar
  const activeCategorySubNames = useMemo(() => {
    const activeCat = data[activeSection];
    if (!activeCat || !activeCat.items) return [];
    const subSet = new Set<string>();
    for (let i = 0; i < activeCat.items.length; i++) {
      const sub = activeCat.items[i].subcategory;
      subSet.add(sub && sub.trim() !== "" ? sub.trim() : "ផ្សេងៗ");
    }
    return Array.from(subSet).sort((a, b) =>
      a === "ផ្សេងៗ" ? 1 : b === "ផ្សេងៗ" ? -1 : 0
    );
  }, [data, activeSection]);

  // Memoized handler for search input change
  const handleSearchInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const query = event.target.value;
      setSearchQuery(query);
    },
    []
  );

  // Scroll to a section based on index
  const handleScroll = (index: number) => {
    if (!renderAllCategories) {
      setRenderAllCategories(true);
    }
    setActiveSection(index);
    setActiveSubSection(""); // Reset sub-section when changing main section
    requestAnimationFrame(() => {
      ref.current[index]?.scrollIntoView({ behavior: "smooth" });
    });
  };

  // Scroll to a sub-section based on sub-category name
  const handleSubScroll = (subName: string) => {
    if (!renderAllCategories) {
      setRenderAllCategories(true);
    }
    setActiveSubSection(subName);
    requestAnimationFrame(() => {
      subRef.current[subName]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };


  if (isNotFound) {
    return <>
      <PageNotFound error="404 Page Not Found" />
    </>
  }



  // Render loading indicator while fetching data
  if (loading) {
    return <Loading className="h-screen fixed w-full z-100 bg-white top-0 flex justify-center items-center  left-0" />;
  }

  // Render the main content once data is loaded
  return (
    <Provider store={store}>

      <div className="w-full  px-3 py-1 fixed flex flex-col gap-2 max-w-[575px] bg-white z-10">
        <NavBar />
        <ul className="no-scrollbar flex flex-nowrap gap-2 overflow-x-scroll" style={{ "paddingBottom": "5px", "borderBottom": "1px solid #4d4f55ff" }}>
          {data.map((item, index) => (
            <li
              key={item.category}
              onClick={() => handleScroll(index)}
              className={`font-dangrek cursor-pointer text-nowrap max-[500px]:text-[14px] text-[17px] py-[5px] px-3 w-fit rounded-full border-orange-600 border-2 ${activeSection === index ? "text-orange-600" : "text-black"
                }`}
            >
              {item.category}
            </li>
          ))}
        </ul>
        {/* Sok Thean Subcategory */}
        {/* SubCategory section */}
        {data[activeSection] && (
          <ul className="no-scrollbar flex flex-nowrap gap-2 overflow-x-scroll" style={{ "margin": "0px 60px", "paddingBottom": "5px" }}>
            {activeCategorySubNames.map((subName) => (
              <li
                key={subName}
                onClick={() => handleSubScroll(`${data[activeSection].category}-${subName}`)}
                className={`font-battambong cursor-pointer text-nowrap max-[500px]:text-[16px] text-[16px] py-[3px] px-3 w-fit rounded-full border-gray-300 border ${activeSubSection === `${data[activeSection].category}-${subName}` ? "bg-orange-600 text-white border-orange-600" : "text-gray-900"
                  }`}
              >
                {subName}
              </li>
            ))}
          </ul>
        )}
        {/*End ST Subcategory*/}
        {/* Search bar component */}
        <SearchBar query={searchQuery} onSearch={handleSearchInput} />
      </div>

      <main className=" pb-[200px] fixed top-3 h-full w-full mt-52 max-[600px]:mt-48  max-w-[575px] overflow-scroll scroll-smooth scroll-pt-0"> {/* Sok Thean popup Component */}
        {/* Navigation and search bar */}


        {/* Main content section */}
        <section className="px-3 mt-5   ">
          {/* Display image slider when no search query */}
          {searchQuery.trim().length <= 0 && <ImageSlider images={images} />}

          <div className="mt-2">
            {/* Render filtered menu items */}
            {/*Sok Thean Night Food 3L*/}
            {groupedMenu.map((category, categoryIndex) => {
              const shouldRenderItems = renderAllCategories || categoryIndex < 2;

              return (
                <div
                  key={category.category}
                  className=""
                  style={
                    categoryIndex >= 1
                      ? { contentVisibility: "auto", containIntrinsicSize: "0 600px" }
                      : undefined
                  }
                  ref={(el) => {
                    ref.current[categoryIndex] = el;
                  }}
                >
                  {/* Display category header if items exist */}
                  {category.items.length > 0 && (
                    <div className="flex gap-3 justify-center  items-center mb-5">
                      <div className="w-20 h-[2px] rounded-full bg-gray-300"></div>
                      <h1
                        id={`${category.category}`}
                        className={`font-bold font-dangrek text-[26px]  text-nowrap  max-[400px]:text-[20px]`}
                      >
                        {category.category}
                      </h1>
                      <div className="w-20 h-[2px] rounded-full bg-gray-300"></div>
                    </div>
                  )}
                  {/*Sok Thean Night Food*/}
                  {/* === Custom UI for list style categories === */}
                  {category.isListStyle ? (
                    <div className="night-food-section">
                      {/* Banner images - retrieve all unique food images in this category */}
                      {shouldRenderItems && category.bannerImages.length > 0 && (
                        <NightFoodBanner
                          images={category.bannerImages}
                          imgUrl={imgUrl}
                        />
                      )}

                      {/* Items listed without images, grouped by subcategory */}
                      <div className="grid grid-cols-1 gap-x-4">
                        {category.subcategories.map(({ subName, items: subItems }) => (
                          <div
                            key={subName}
                            className="mb-4"
                            ref={(el) => {
                              subRef.current[`${category.category}-${subName}`] = el;
                            }}
                          >
                            <h2 className="font-battambong text-[24px] font-semibold mb-1 px-1 text-black">
                              {subName}
                            </h2>
                            {shouldRenderItems && (
                              <div className="flex flex-col w-full">
                                {subItems.map((item) => (
                                  <NightFoodCart
                                    key={item.id}
                                    cartItem={item}
                                    isOrderPage={isOrderPage}
                                    cur={cur}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Sok Thean Subcategory */}
                      {/* Display items grouped by sub-category */}
                      {category.subcategories.map(({ subName, items: subItems }) => (
                        <div
                          key={subName}
                          className="mb-8"
                          ref={(el) => {
                            subRef.current[`${category.category}-${subName}`] = el;
                          }}
                        >
                          <h2 className="font-battambong text-[20px] font-semibold mb-2 px-1 text-black">
                            {subName}
                          </h2>
                          {shouldRenderItems && (
                            <div className="flex flex-wrap flex-row justify-between gap-y-4">
                              {subItems.map((item) => (
                                <Cart
                                  key={item.id}
                                  cartItem={item}
                                  isOrderPage={isOrderPage}
                                  cur={cur}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {/*End ST Subcategory*/}
                    </>
                  )}
                </div>
              );
            })}
            {/*End ST Night Food*/}
          </div>
        </section>

        {/* Bottom action bar */}
        <div className="fixed bottom-0 px-4 py-4 max-w-[575px] z-[50] items-center w-full cursor-pointer rounded-t-2xl bg-white flex justify-between shadow-[0_-5px_15px_rgba(0,0,0,0.1)]"> {/* Sok Thean popup Component */}
          {/* Display order item component */}
          <OrderItem
            cur={cur}
            historyOrder={historyOrder}
            setHistoryOrder={setHistoryOrder}
            isClickOrder={isClickOrder}
            setClickOrder={setClickOrder}
            menuData={data}
          />
          {/* Basket bar component */}
          <BasketBar cur={cur} historyOrder={historyOrder} />

          {/* Button to trigger modal */}
          <button
            onClick={async () => {
              try {
                (document.getElementById(
                  "my_modal_10"
                ) as HTMLDialogElement).showModal();
                // await axios.post(""); // Placeholder post request
              } catch (error) {
                console.error("Error posting data:", error);
              }
            }}
            className="bg-gray-200 w-14 h-14 flex justify-center items-center rounded-full border-orange-600 border-2"
          >
            {/* Image icon */}
            <img
              className="w-10 h-10 max-[450px]:w-8"
              src={"/icons/service-bell.svg"}
              alt=""
              width={100}
              height={100}
            />
          </button>
          {/* Model component */}
          <Model />
        </div>

        {/* Footer section */}
        <footer className="mt-16 pb-[120px]">
          {/* Display not found message when no items */}
          {groupedMenu.length <= 0 && <NotFound />}
          <Footer />
        </footer>
      </main>
    </Provider>
  );
}
