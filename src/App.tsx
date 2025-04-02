
import React, { useState, useEffect, useRef } from "react";
import * as turf from '@turf/turf';
import { greeceCoastline } from './data/greece-coastline';
import { generateRays, intersectsCoastline } from './utils/coastlineAnalysis';
import {
  MapPin,
  Home,
  Clock,
  Wind,
  Waves,
  Thermometer,
  Droplets,
  Sun,
  AlertCircle,
  Plus,
  Map,
  ChevronLeft,
  Calendar,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Info,
  Trash2,
  RefreshCw,
} from "lucide-react";

// Full original App component follows with geospatial logic externalized
