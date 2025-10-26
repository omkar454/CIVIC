import React, { useState, useEffect, useCallback } from 'react';
import Image1 from '../assets/image1.jpg';
import Image2 from '../assets/image2.jpeg';
import Image3 from '../assets/image3.jpeg';
import Image4 from '../assets/hero1.jpeg';
import imagebg from '../assets/imagebg.jpg';
import Image5 from '../assets/image5.jpeg';

import ChatBotModal from "../components/ChatBotModal";
import GoogleTranslateLanding from "../components/GoogleTranslateLanding";


// --- SVG Icons ---
const MenuIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
  </svg>
);

const XIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ChevronLeftIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
);

const ChevronRightIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
);

const PlayCircleIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
);
const heroSlides = [
  {
    image: Image1, // <-- CHANGE THIS from newsImg to heroImg1
    subtitle: "Bandra Municipal Corporation Welcomes You",
    title: "A Smarter City Starts With You.",
  },
  {
    image: Image2, 
    subtitle: "Community-Driven Public Issue Tracker",
    title: "Report, Track, and Resolve.",
  },
  {
    image: Image5, 
    subtitle: "Building a Better Bandra, Together",
    title: "Your Voice Matters.",
  },
];
const GovernmentIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>;
const JobsIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path></svg>;
const BusinessIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M12 10V3L4 7v4"></path><path d="m12 10 8-4"></path><path d="M12 10v4l8 4"></path><path d="m4 11 8 4"></path></svg>;
const RoadsIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 13.5V4a2 2 0 0 1 2-2h4"></path><path d="M14 20v-5a2 2 0 0 0-2-2h-4"></path><path d="M14 10h2a2 2 0 0 1 2 2v8"></path><path d="M4 18h4"></path><path d="M18 6h-4a2 2 0 0 0-2 2v4"></path></svg>;
const CultureIcon = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M12 10V3L4 7v4"></path><path d="m12 10 8-4"></path><path d="M12 10v4l8 4"></path><path d="m4 11 8 4"></path></svg>;


// --- Components ---

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="bg-white shadow-md fix top-0 w-full z-30">
           {" "}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* --- MODIFICATIONS ARE IN THIS DIV --- */}       {" "}
        <div className="relative flex items-center justify-center h-20">
                   {/* --- LOGO REMOVED --- */}         {" "}
          <div className="hidden md:flex items-center space-x-8">
                       {" "}
            <a
              href="#home"
              className="text-gray-700 font-medium hover:text-green-600 transition duration-300"
            >
              Home
            </a>
                       {" "}
            <a
              href="#features"
              className="text-gray-700 font-medium hover:text-green-600 transition duration-300"
            >
              Our Project
            </a>
                       {" "}
            <a
              href="#vision"
              className="text-gray-700 font-medium hover:text-green-600 transition duration-300"
            >
              About Us
            </a>
                       {" "}
            <a
              href="#contact"
              className="text-gray-700 font-medium hover:text-green-600 transition duration-300"
            >
              Contact
            </a>
                     {" "}
          </div>
                   {/* --- THIS DIV IS NOW ABSOLUTELY POSITIONED --- */}
          <div className="hidden md:flex items-center gap-4 absolute right-0 top-1/2 -translate-y-1/2">
            <a
              href="/login"
              className="text-gray-700 font-medium px-6 py-3 rounded-md hover:bg-gray-100 transition duration-300"
            >
              Login
            </a>
            <a
              href="/login"
              className="bg-green-600 text-white font-semibold px-6 py-3 rounded-md hover:bg-green-700 transition duration-300"
            >
              Report Issue
            </a>

            {/* ✅ Added Google Translate beside Report Issue */}
            <div className="ml-2 relative z-50">
              <GoogleTranslateLanding />
            </div>
          </div>
          {/* --- THIS DIV IS ALSO ABSOLUTELY POSITIONED --- */}         {" "}
          <div className="md:hidden flex items-center absolute right-0 top-1/2 -translate-y-1/2">
                       {" "}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-800 hover:text-green-600 focus:outline-none"
            >
                            <span className="sr-only">Open main menu</span>     
                     {" "}
              {isOpen ? (
                <XIcon className="h-6 w-6" />
              ) : (
                <MenuIcon className="h-6 w-6" />
              )}
                         {" "}
            </button>
                     {" "}
          </div>
                 {" "}
        </div>
             {" "}
      </nav>
      {/* The mobile dropdown menu is unaffected and remains the same */}     {" "}
      {isOpen && (
        <div className="md:hidden bg-white">
                   {" "}
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 text-center">
                       {" "}
            <a
              href="#home"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-green-600 hover:bg-gray-50"
            >
              Home
            </a>
           {" "}
            <a
              href="#features"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-green-600 hover:bg-gray-50"
            >
              Our Project
            </a>
    {" "}
            <a
              href="#vision"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-green-600 hover:bg-gray-50"
            >
              About Us
            </a>
                       {" "}
            <a
              href="#contact"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-green-600 hover:bg-gray-50"
            >
              Contact
            </a>
                       {" "}
            <a
              href="/login"
              className="block w-full text-center mt-2 px-6 py-3 border border-green-600 text-green-600 rounded-md hover:bg-green-50 transition duration-300"
            >
              Login
            </a>
            s         {" "}
            <a
              href="#"
              className="block w-full text-center mt-2 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition duration-300"
            >
              Report Issue
            </a>
                     {" "}
          </div>
                 {" "}
        </div>
      )}
         {" "}
    </header>
  );
};
const Hero = () => {
    const [currentSlide, setCurrentSlide] = useState(0);

    const nextSlide = useCallback(() => {
        setCurrentSlide(prev => (prev === heroSlides.length - 1 ? 0 : prev + 1));
    }, []);

    const prevSlide = () => {
        setCurrentSlide(prev => (prev === 0 ? heroSlides.length - 1 : prev - 1));
    };
    
    useEffect(() => {
        const slideInterval = setInterval(nextSlide, 5000);
        return () => clearInterval(slideInterval);
    }, [nextSlide]);

    return (
        <section id="home" className="relative bg-gray-900 text-white overflow-hidden">
            <div className="relative h-[calc(100vh-80px)] min-h-[600px]">
                {heroSlides.map((slide, index) => (
                    <div
                        key={index}
                        className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
                    >
                        <div
                            className="absolute inset-0 bg-cover bg-center"
                            style={{ backgroundImage: `url('${slide.image}')` }}
                        ></div>
                    </div>
                ))}
                
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center text-left">
                    <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mt-4 animate-fade-in-up animation-delay-300" style={{ animationDelay: '0.3s' }}>
                        {heroSlides[currentSlide].title.split('.').map((part, i) => <span key={i}>{part}.<br/></span>)}
                    </h1>
                    <a href="#" className="mt-8 inline-block bg-green-600 text-white font-semibold px-8 py-3 rounded-md shadow-lg hover:bg-green-700 transition-transform transform hover:scale-105 duration-300 max-w-max animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
                        Discover More
                    </a>
                </div>

                {/* Navigation Arrows Fix for Visibility */}
                <div className="absolute bottom-10 right-10 flex items-center gap-4">
                    <button
                        onClick={prevSlide}
                        className="w-12 h-12 flex items-center justify-center rounded-full bg-white bg-opacity-90 hover:bg-opacity-100 shadow-lg transition"
                    >
                        <ChevronLeftIcon className="h-6 w-6 text-gray-900" />
                    </button>
                    <button
                        onClick={nextSlide}
                        className="w-12 h-12 flex items-center justify-center rounded-full bg-white bg-opacity-90 hover:bg-opacity-100 shadow-lg transition"
                    >
                        <ChevronRightIcon className="h-6 w-6 text-gray-900" />
                    </button>
                </div>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {heroSlides.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentSlide(index)}
                            className={`w-3 h-3 rounded-full transition-colors ${currentSlide === index ? 'bg-white' : 'bg-white bg-opacity-30'}`}
                        ></button>
                    ))}
                </div>
            </div>
        </section>
    );
};


const WhyCivic = () => (
    <section id="features" className="relative py-20 bg-gray-900 text-white">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-10"
          style={{backgroundImage: `url('${imagebg}')`}}>
       </div>
       <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl font-bold">Why CIVIC?</h2>
            <p className="mt-4 text-lg text-gray-400 max-w-3xl mx-auto">
                CIVIC provides a transparent and digital way to bring attention to everyday problems. From potholes and broken streetlights to waste management and water supply issues.
            </p>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
                <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 hover:border-green-500 transition-colors">
                    <h3 className="text-xl font-semibold mb-2">🚩 Raise Issues Easily</h3>
                    <p className="text-gray-400">Submit problems with location, description, and photos in minutes.</p>
                </div>
                <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 hover:border-green-500 transition-colors">
                    <h3 className="text-xl font-semibold mb-2">👥 Community Participation</h3>
                    <p className="text-gray-400">See if others face the same issue and upvote to highlight its importance.</p>
                </div>
                <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 hover:border-green-500 transition-colors">
                    <h3 className="text-xl font-semibold mb-2">📍 Location-Based Tracking</h3>
                    <p className="text-gray-400">Identify issues near you using our interactive map system.</p>
                </div>
                 <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 hover:border-green-500 transition-colors">
                    <h3 className="text-xl font-semibold mb-2">🏛 Bridge Citizens & Authorities</h3>
                    <p className="text-gray-400">Helps the Bandra Municipal Corporation prioritize and act faster.</p>
                </div>
                <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 hover:border-green-500 transition-colors">
                    <h3 className="text-xl font-semibold mb-2">✅ Transparency & Accountability</h3>
                    <p className="text-gray-400">Everyone can track the status of reported issues from start to finish.</p>
                </div>
                 <div className="bg-green-600 p-8 rounded-lg text-center flex flex-col justify-center">
                    <h3 className="text-2xl font-bold">Our Vision</h3>
                    <p className="mt-2">To empower our community where every voice counts for a smarter, cleaner Bandra.</p>
                </div>
            </div>
       </div>
    </section>
);

const VideoCta = () => (
    <section className="relative py-24 bg-gray-800 text-white">
        <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{backgroundImage: "url('https://placehold.co/1920x800/111/FFF?text=Bandra+Neighborhood')"}}></div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <button className="w-24 h-24 flex items-center justify-center rounded-full bg-green-600 hover:bg-green-700 transition-all duration-300 transform hover:scale-110 mx-auto">
                <PlayCircleIcon className="h-16 w-16 text-white"/>
            </button>
            <h2 className="text-4xl font-bold mt-8">We help you solve your city government problems</h2>
        </div>
    </section>
);


const Stats = () => (
    <div className="bg-green-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
                <p className="text-5xl font-bold">12,500+</p>
                <p className="mt-2 opacity-80">Issues Resolved</p>
            </div>
            <div>
                <p className="text-5xl font-bold">92%</p>
                <p className="mt-2 opacity-80">Citizen Satisfaction Rate</p>
            </div>
            <div>
                <p className="text-5xl font-bold">7 Days</p>
                <p className="mt-2 opacity-80">Average Resolution Time</p>
            </div>
        </div>
    </div>
);

const AboutUs = () => (
  <section id="vision" className="py-20 bg-gray-900 text-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <h2 className="text-4xl font-bold mb-4">About Us</h2>
      <p className="text-gray-400 mb-12 max-w-2xl mx-auto">
        Meet the passionate team behind CIVIC, working together to make Bandra a
        smarter and cleaner city.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
        {/* Aryan Slaunke */}
        <div className="flex flex-col items-center">
          <img
            src="https://i.pravatar.cc/150?img=12"
            alt="Aryan Slaunke"
            className="w-32 h-32 rounded-full object-cover mb-4 border-4 border-green-600"
          />
          <h4 className="text-xl font-semibold">Aryan Salunke</h4>
          <p className="text-gray-400 text-center mt-1">
            Machine Learning Engineer with expertise in predictive modeling.
            Passionate about leveraging AI to solve real-world civic problems.
          </p>
        </div>
        {/* Vedant Patil */}
        <div className="flex flex-col items-center">
          <img
            src="https://i.pravatar.cc/150?img=14"
            alt="Vedant Patil"
            className="w-32 h-32 rounded-full object-cover mb-4 border-4 border-green-600"
          />
          <h4 className="text-xl font-semibold">Vedant Patil</h4>
          <p className="text-gray-400 text-center mt-1">
            Skilled ML Engineer focusing on computer vision and automation.
            Enjoys creating models that enhance community engagement.
          </p>
        </div>
        {/* Aryan Pathsk */}
        <div className="flex flex-col items-center">
          <img
            src="https://i.pravatar.cc/150?img=16"
            alt="Aryan Pathsk"
            className="w-32 h-32 rounded-full object-cover mb-4 border-4 border-green-600"
          />
          <h4 className="text-xl font-semibold">Aryan Pathak</h4>
          <p className="text-gray-400 text-center mt-1">
            Mobile App Developer building intuitive and user-friendly
            interfaces. Passionate about enhancing citizen experience through
            apps.
          </p>
        </div>
        {/* Omkar Raut */}
        <div className="flex flex-col items-center">
          <img
            src="https://i.pravatar.cc/150?img=18"
            alt="Omkar Raut"
            className="w-32 h-32 rounded-full object-cover mb-4 border-4 border-green-600"
          />
          <h4 className="text-xl font-semibold">Omkar Raut</h4>
          <p className="text-gray-400 text-center mt-1">
            Web Developer specializing in full-stack solutions. Loves creating
            robust and responsive platforms for civic engagement.
          </p>
        </div>
      </div>
    </div>
  </section>
);


const HowItWorks = () => (
  <section id="how-it-works" className="py-20 bg-gray-800 text-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 lg:flex lg:gap-16 items-center">
        <div className="lg:w-1/2">
            <span className="font-bold text-green-500">★ HOW IT WORKS</span>
            <h2 className="text-4xl font-bold mt-4">A simple process for a better community</h2>
            <p className="text-gray-400 mt-6">We've streamlined the process of civic engagement. In just a few steps, you can make a tangible difference in our neighborhood.</p>
            <ul className="mt-6 space-y-2">
                <li className="flex items-center"><span className="text-green-500 mr-2">✔</span> Report an issue with photos and location.</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✔</span> Track its progress with real-time updates.</li>
                <li className="flex items-center"><span className="text-green-500 mr-2">✔</span> Engage with your community on important issues.</li>
                 <li className="flex items-center"><span className="text-green-500 mr-2">✔</span> Get notified when the issue is resolved.</li>
            </ul>
            <a href="#" className="mt-8 inline-block bg-green-600 text-white font-semibold px-8 py-3 rounded-md shadow-lg hover:bg-green-700 transition duration-300">
                Learn More
            </a>
        </div>
        <div className="lg:w-1/2 mt-12 lg:mt-0 space-y-4">
            <div className="bg-gray-900 rounded-lg p-6 flex items-start gap-4 border border-gray-700">
                <div className="text-3xl font-bold text-green-500">1</div>
                <div>
                    <h4 className="font-bold text-lg">Report</h4>
                    <p className="text-gray-400">Share an issue with description, photo, and location.</p>
                </div>
            </div>
             <div className="bg-gray-900 rounded-lg p-6 flex items-start gap-4 border border-gray-700">
                <div className="text-3xl font-bold text-green-500">2</div>
                <div>
                    <h4 className="font-bold text-lg">Track</h4>
                    <p className="text-gray-400">Follow the progress as authorities update status.</p>
                </div>
            </div>
             <div className="bg-gray-900 rounded-lg p-6 flex items-start gap-4 border border-gray-700">
                <div className="text-3xl font-bold text-green-500">3</div>
                <div>
                    <h4 className="font-bold text-lg">Resolve</h4>
                    <p className="text-gray-400">Once fixed, the issue is marked as Resolved for all to see.</p>
                </div>
            </div>
        </div>
    </div>
  </section>
);


const Footer = () => (
  <footer id="contact" className="bg-gray-900 text-gray-400">
    <div className="bg-black py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 md:flex md:justify-between md:items-center">
            <h3 className="text-2xl font-semibold text-white">Subscribe to Newsletter</h3>
            <form className="mt-4 md:mt-0 flex w-full md:w-1/2">
                <input type="email" placeholder="Email Address" className="w-full px-4 py-3 rounded-l-md bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-green-500"/>
                <button type="submit" className="bg-green-600 text-white font-semibold px-6 py-3 rounded-r-md hover:bg-green-700">Subscribe</button>
            </form>
        </div>
    </div>
    <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div>
            <h4 className="text-lg font-semibold text-white mb-4">Contact</h4>
            <p className="mb-2">Bandra Municipal Corporation, Hill Road, Bandra (W), Mumbai - 400050</p>
            <a href="mailto:contact@bandramc.gov.in" className="block mb-2 hover:text-green-500">contact@bandramc.gov.in</a>
            <a href="tel:+912226425894" className="block hover:text-green-500">+91 22 2642 5894</a>
        </div>
        <div>
            <h4 className="text-lg font-semibold text-white mb-4">Links</h4>
            <ul>
                <li className="mb-2"><a href="#" className="hover:text-green-500">About CIVIC</a></li>
                <li className="mb-2"><a href="#" className="hover:text-green-500">Our Team</a></li>
                <li className="mb-2"><a href="#" className="hover:text-green-500">Upcoming Events</a></li>
                <li className="mb-2"><a href="#" className="hover:text-green-500">Latest News</a></li>
                <li className="mb-2"><a href="#" className="hover:text-green-500">Contact Us</a></li>
            </ul>
        </div>
        <div>
            <h4 className="text-lg font-semibold text-white mb-4">Departments</h4>
            <ul>
                <li className="mb-2"><a href="#" className="hover:text-green-500">Public Works</a></li>
                <li className="mb-2"><a href="#" className="hover:text-green-500">Waste Management</a></li>
                <li className="mb-2"><a href="#" className="hover:text-green-500">Water Supply</a></li>
                <li className="mb-2"><a href="#" className="hover:text-green-500">Health & Safety</a></li>
                <li className="mb-2"><a href="#" className="hover:text-green-500">Permits & Licenses</a></li>
            </ul>
        </div>
        <div>
            <h4 className="text-lg font-semibold text-white mb-4">Gallery</h4>
            <div className="grid grid-cols-3 gap-2">
                <img src="https://placehold.co/100x100/333/FFF?text=City" className="rounded"/>
                <img src="https://placehold.co/100x100/333/FFF?text=People" className="rounded"/>
                <img src="https://placehold.co/100x100/333/FFF?text=Work" className="rounded"/>
                <img src="https://placehold.co/100x100/333/FFF?text=Event" className="rounded"/>
                <img src="https://placehold.co/100x100/333/FFF?text=Office" className="rounded"/>
                <img src="https://placehold.co/100x100/333/FFF?text=Building" className="rounded"/>
            </div>
        </div>
    </div>
    <div className="border-t border-gray-800 py-6">
      <p className="text-center text-sm">
        &copy; 2025 Bandra Municipal Corporation. All rights reserved.
      </p>
    </div>
  </footer>
);


export default function LandingPage() {
    const [showChatModal, setShowChatModal] = useState(false);

    const handleOpenChat = () => setShowChatModal(true);
    const handleCloseChat = () => setShowChatModal(false);

  return (
    <div className="bg-gray-900 font-sans">
      <Header />
      <main>
        <Hero />
        <WhyCivic />
        <Stats />
        <HowItWorks />
        <AboutUs />
        {/* Floating Buttons - Chatbot + Translate */}
        <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
          {/* Chatbot Floating Button */}
          <button
            onClick={handleOpenChat}
            className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-full shadow-lg hover:scale-105 transition-transform"
            aria-label="Open Civic Assistant"
          >
            <svg
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
            >
              <rect
                x="6"
                y="10"
                width="20"
                height="12"
                rx="6"
                stroke="#20E0E0"
                strokeWidth="2"
              />
              <rect
                x="2"
                y="15"
                width="4"
                height="4"
                rx="1"
                stroke="#20E0E0"
                strokeWidth="2"
              />
              <rect
                x="26"
                y="15"
                width="4"
                height="4"
                rx="1"
                stroke="#20E0E0"
                strokeWidth="2"
              />
              <rect x="11" y="15" width="2" height="4" rx="1" fill="#20E0E0" />
              <rect x="19" y="15" width="2" height="4" rx="1" fill="#20E0E0" />
              <rect x="15" y="6" width="2" height="6" rx="1" fill="#20E0E0" />
            </svg>
          </button>
        </div>
        {/* Chat Modal */}
        {showChatModal && <ChatBotModal onClose={handleCloseChat} />}
      </main>

      <Footer />
    </div>
  );
}
